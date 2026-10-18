/**
 * Live Call engine.
 *
 *   mic ──WebRTC──► OpenAI Realtime (listens, answers as text in the persona)
 *   answer text ──► /api/avatar/live/speech (ElevenLabs clone, PCM 16 kHz)
 *   PCM ──────────► Simli (lip-synced face + the voice the family hears)
 *
 * One session at a time per page. Barge-in: when the visitor starts talking,
 * the pending speech is dropped and the face goes quiet.
 */
import { SimliClient, LogLevel } from 'simli-client'
import { avatarApi } from './api'
import { playMedia } from './playMedia'
import { withTimeout } from './withTimeout'
import { textMatchesSessionLanguage } from './languageScript'

export interface LiveSessionHandlers {
  onStatus: (msg: string) => void
  onVideoReady: () => void
  onCaption: (text: string) => void
  onCaptionClear: () => void
  onEnded: () => void
}

export interface LiveSession {
  stop: () => Promise<void>
  languageCode: string
}

const BYTES_PER_MS = 32 // PCM16 mono 16 kHz
const SIMLI_CHUNK_BYTES = 6000
const CAPTION_LEAD_MS = 350
const CAPTION_CLEAR_MS = 2800
const OPENAI_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

let activeSession: LiveSession | null = null

/** Stop whatever call is running on this page (one face stream at a time). */
export async function stopActiveLiveSession() {
  const s = activeSession
  activeSession = null
  if (s) await s.stop().catch(() => {})
}

/* ----------------------------- sentence splitting ----------------------------- */

const TERMINATORS = /[.!?…。！？]/

/** Pull complete sentences off the front of the buffer; leave the unfinished tail. */
export function takeSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = []
  let rest = buffer
  for (;;) {
    let cut = -1
    for (let i = 0; i < rest.length - 1; i += 1) {
      if (!TERMINATORS.test(rest[i])) continue
      // Keep "3.5" and "Dr. " style abbreviations together; split only before whitespace.
      if (!/\s/.test(rest[i + 1])) continue
      if (i + 1 < 8) continue
      cut = i + 1
      break
    }
    if (cut < 0) {
      // Long run with no sentence end — break on a clause boundary so speech starts sooner.
      if (rest.length > 160) {
        const clause = Math.max(rest.lastIndexOf(', ', 150), rest.lastIndexOf('; ', 150), rest.lastIndexOf(' — ', 150))
        if (clause > 40) cut = clause + 1
      }
      if (cut < 0) break
    }
    const head = rest.slice(0, cut).trim()
    rest = rest.slice(cut).replace(/^\s+/, '')
    if (head) sentences.push(head)
  }
  return { sentences, rest }
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/[*_`#>]+/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ------------------------------- speech queue --------------------------------- */

class SpeechQueue {
  private chain: Promise<void> = Promise.resolve()
  private controllers = new Set<AbortController>()
  private playheadEnd = 0
  private captionTimers: number[] = []
  private clearTimer = 0
  private generation = 0
  private pending = 0
  private simli: SimliClient
  private ticket: string
  private languageCode: string
  private handlers: Pick<LiveSessionHandlers, 'onCaption' | 'onCaptionClear'>
  private alive: () => boolean

  constructor(
    simli: SimliClient,
    ticket: string,
    languageCode: string,
    handlers: Pick<LiveSessionHandlers, 'onCaption' | 'onCaptionClear'>,
    alive: () => boolean,
  ) {
    this.simli = simli
    this.ticket = ticket
    this.languageCode = languageCode
    this.handlers = handlers
    this.alive = alive
  }

  get busy() {
    return this.pending > 0 || performance.now() < this.playheadEnd
  }

  speak(text: string) {
    const spoken = cleanForSpeech(text)
    if (!spoken) return
    const gen = this.generation
    const controller = new AbortController()
    this.controllers.add(controller)
    // Start the voice fetch now; play it in order behind whatever is already queued.
    const stream = avatarApi.liveSpeech(this.ticket, spoken, controller.signal)
    this.pending += 1
    this.chain = this.chain
      .then(() => this.pump(stream, spoken, gen, controller))
      .catch(() => {})
      .finally(() => {
        this.pending -= 1
        this.controllers.delete(controller)
        if (this.pending === 0 && gen === this.generation) this.scheduleClear()
      })
  }

  /** Visitor started talking — drop everything queued and silence the face. */
  interrupt() {
    this.generation += 1
    for (const c of this.controllers) c.abort()
    this.controllers.clear()
    this.chain = Promise.resolve()
    this.playheadEnd = 0
    this.cancelCaptionTimers()
    if (this.clearTimer) window.clearTimeout(this.clearTimer)
    try { this.simli.ClearBuffer() } catch { /* socket may be closing */ }
    this.handlers.onCaptionClear()
  }

  dispose() {
    this.interrupt()
  }

  private cancelCaptionTimers() {
    for (const t of this.captionTimers) window.clearTimeout(t)
    this.captionTimers = []
  }

  private scheduleClear() {
    if (this.clearTimer) window.clearTimeout(this.clearTimer)
    const wait = Math.max(0, this.playheadEnd - performance.now()) + CAPTION_CLEAR_MS
    this.clearTimer = window.setTimeout(() => {
      if (this.alive()) this.handlers.onCaptionClear()
    }, wait)
  }

  private async pump(streamPromise: Promise<ReadableStream<Uint8Array>>, caption: string, gen: number, controller: AbortController) {
    const stream = await streamPromise
    const reader = stream.getReader()
    let carry = new Uint8Array(0)
    let captionScheduled = false
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done || gen !== this.generation || !this.alive()) break
        if (!value?.length) continue

        let buf: Uint8Array
        if (carry.length) {
          buf = new Uint8Array(carry.length + value.length)
          buf.set(carry, 0)
          buf.set(value, carry.length)
        } else {
          buf = value
        }
        // PCM16 — never split a sample across sends.
        const usable = buf.length - (buf.length % 2)
        carry = buf.slice(usable)
        if (!usable) continue

        if (!captionScheduled) {
          captionScheduled = true
          const startsIn = Math.max(0, this.playheadEnd - performance.now()) + CAPTION_LEAD_MS
          if (this.clearTimer) window.clearTimeout(this.clearTimer)
          this.captionTimers.push(window.setTimeout(() => {
            if (gen !== this.generation || !this.alive()) return
            if (textMatchesSessionLanguage(caption, this.languageCode)) this.handlers.onCaption(caption)
            else this.handlers.onCaptionClear()
          }, startsIn))
        }

        for (let off = 0; off < usable; off += SIMLI_CHUNK_BYTES) {
          const slice = buf.subarray(off, Math.min(usable, off + SIMLI_CHUNK_BYTES))
          try {
            this.simli.sendAudioData(new Uint8Array(slice))
          } catch (e) {
            console.warn('[live] simli send failed', e)
            return
          }
        }
        this.playheadEnd = Math.max(this.playheadEnd, performance.now()) + usable / BYTES_PER_MS
      }
    } finally {
      reader.cancel().catch(() => {})
      controller.abort()
    }
  }
}

/* ------------------------------ OpenAI listening ------------------------------ */

type RealtimeEvent = {
  type: string
  response_id?: string
  response?: { id?: string; status?: string }
  delta?: string
  error?: { message?: string; code?: string }
}

async function waitForIce(pc: RTCPeerConnection, ms = 2500) {
  if (pc.iceGatheringState === 'complete') return
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, ms)
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timer)
        resolve()
      }
    })
  })
}

async function connectListener(opts: {
  token: string
  mic: MediaStream
  onEvent: (e: RealtimeEvent) => void
  onOpen: (send: (e: object) => void) => void
  onClosed: () => void
}) {
  const pc = new RTCPeerConnection()
  for (const track of opts.mic.getAudioTracks()) pc.addTrack(track, opts.mic)
  const dc = pc.createDataChannel('oai-events')
  const send = (e: object) => {
    if (dc.readyState === 'open') dc.send(JSON.stringify(e))
  }
  dc.addEventListener('message', (m) => {
    try { opts.onEvent(JSON.parse(m.data) as RealtimeEvent) } catch { /* ignore */ }
  })
  dc.addEventListener('open', () => opts.onOpen(send))
  dc.addEventListener('close', opts.onClosed)
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') opts.onClosed()
  })

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await waitForIce(pc)
  const sdp = pc.localDescription?.sdp
  if (!sdp) throw new Error('Could not prepare the microphone connection')

  const res = await fetch(OPENAI_CALLS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/sdp' },
    body: sdp,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    try { pc.close() } catch { /* ignore */ }
    const unavailable = res.status === 429 || /credit_balance_exhausted|insufficient_quota|no credits/i.test(text)
    const error = new Error(unavailable
      ? 'Listening service is out of credits'
      : `Listening service error ${res.status}: ${text.slice(0, 200)}`)
    if (unavailable) error.name = 'ListeningUnavailable'
    throw error
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() })
  return { pc, dc, send }
}

const SPEECH_LANG: Record<string, string> = {
  en: 'en-US', he: 'he-IL', ar: 'ar', ru: 'ru-RU', fr: 'fr-FR', es: 'es-ES',
  de: 'de-DE', pt: 'pt-BR', it: 'it-IT', nl: 'nl-NL', pl: 'pl-PL', uk: 'uk-UA',
  tr: 'tr-TR', fa: 'fa-IR', hi: 'hi-IN', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR',
}

type BrowserSpeech = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

/** OpenAI Realtime is out of credits. Chrome's speech recognition listens, Claude answers. */
function listenInBrowser(opts: {
  ticket: string
  languageCode: string
  queue: SpeechQueue
  mic: MediaStream
  alive: () => boolean
  onFail: (message: string) => void
}) {
  const Ctor = (window as unknown as {
    SpeechRecognition?: new () => BrowserSpeech
    webkitSpeechRecognition?: new () => BrowserSpeech
  }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeech }).webkitSpeechRecognition
  if (!Ctor) {
    throw new Error('The listening service is out of credits, and this browser cannot hear the microphone. Open the call in Chrome.')
  }
  opts.mic.getTracks().forEach((track) => track.stop())
  const rec = new Ctor()
  rec.continuous = true
  rec.interimResults = false
  rec.lang = SPEECH_LANG[opts.languageCode] || opts.languageCode || 'en-US'
  const history: { role: 'user' | 'assistant'; text: string }[] = []
  let replying = false

  const speakAnswer = (text: string) => {
    const parts = text.split(/(?<=[.!?…。！？])\s+/).map((part) => part.trim()).filter(Boolean)
    for (const part of (parts.length ? parts : [text])) opts.queue.speak(part)
  }

  const ask = async (text: string) => {
    if (!opts.alive() || replying) return
    replying = true
    try { rec.stop() } catch { /* not started yet */ }
    try {
      const { text: answer } = await avatarApi.liveReply(opts.ticket, text, history)
      const spoken = (answer || '').trim()
      if (!spoken || !opts.alive()) return
      history.push({ role: 'user', text }, { role: 'assistant', text: spoken })
      if (history.length > 8) history.splice(0, history.length - 8)
      speakAnswer(spoken)
    } catch (e) {
      opts.onFail(e instanceof Error ? e.message : 'Could not answer')
    } finally {
      replying = false
    }
  }

  rec.onresult = (event) => {
    if (!opts.alive()) return
    let said = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      if (result.isFinal) said += result[0]?.transcript || ''
    }
    said = said.trim()
    if (!said) return
    if (opts.queue.busy) opts.queue.interrupt()
    void ask(said)
  }
  rec.onerror = (event) => {
    if (event.error === 'not-allowed') opts.onFail('Allow microphone access in your browser to talk, then tap Try again.')
  }
  rec.onend = () => { /* the pump starts it again once the face is quiet */ }

  const pump = window.setInterval(() => {
    if (!opts.alive() || replying || opts.queue.busy) return
    try { rec.start() } catch { /* already listening */ }
  }, 700)
  void ask('The call just connected. Greet me now in one or two short sentences.')
  return () => {
    window.clearInterval(pump)
    try { rec.abort() } catch { /* ignore */ }
  }
}

/* ---------------------------------- session ----------------------------------- */

export async function startLiveSession(opts: {
  creatorId?: string
  videoEl: HTMLVideoElement
  handlers: LiveSessionHandlers
  stale: () => boolean
}): Promise<LiveSession> {
  const { videoEl, handlers, stale } = opts
  await stopActiveLiveSession()
  if (stale()) throw new Error('Connect cancelled')

  handlers.onStatus('Starting live session…')
  const start = await withTimeout(avatarApi.startLive(opts.creatorId), 45000, 'Starting live session')
  if (stale()) throw new Error('Connect cancelled')
  if (!start.usingOwnVoice) {
    throw new Error('Your voice was not cloned successfully. Re-record your voice in Voice & photograph — the live call will not use a stock voice.')
  }
  if (!start.simliToken) {
    throw new Error('Live call did not return a face session. Refresh the page and try again.')
  }
  const languageCode = start.languageCode || 'en'

  handlers.onStatus('Turning on the microphone…')
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  if (stale()) {
    mic.getTracks().forEach((t) => t.stop())
    throw new Error('Connect cancelled')
  }

  // Simli needs its own audio element; keep it in the DOM but out of sight.
  const audioEl = document.createElement('audio')
  audioEl.autoplay = true
  audioEl.setAttribute('playsinline', 'true')
  audioEl.style.display = 'none'
  document.body.appendChild(audioEl)
  videoEl.muted = true
  videoEl.playsInline = true

  let alive = true
  let ended = false
  let simli: SimliClient | null = null
  let stopBrowser = () => {}
  let pc: RTCPeerConnection | null = null
  let dc: RTCDataChannel | null = null
  let queue: SpeechQueue | null = null

  const finish = () => {
    if (ended) return
    ended = true
    if (alive && !stale()) handlers.onEnded()
  }

  const stop = async () => {
    alive = false
    if (activeSession === session) activeSession = null
    stopBrowser()
    queue?.dispose()
    try { dc?.close() } catch { /* ignore */ }
    try { pc?.close() } catch { /* ignore */ }
    mic.getTracks().forEach((t) => t.stop())
    try { await withTimeout(simli?.stop() ?? Promise.resolve(), 5000, 'Closing face stream') } catch { /* ignore */ }
    try { videoEl.srcObject = null } catch { /* ignore */ }
    audioEl.remove()
  }
  const session: LiveSession = { stop: () => stop(), languageCode }
  activeSession = session

  try {
    handlers.onStatus('Connecting video…')
    const ice = (start.iceServers || []).filter((server) => server?.urls)
    // LiveKit on this Simli account answers 429 and drops the room. A direct
    // WebRTC connection uses the ICE servers from our API instead.
    simli = ice.length
      ? new SimliClient(start.simliToken, videoEl, audioEl, ice, LogLevel.ERROR, 'p2p')
      : new SimliClient(start.simliToken, videoEl, audioEl, null, LogLevel.ERROR, 'livekit')
    simli.on('start', () => {
      if (!alive || stale()) return
      handlers.onVideoReady()
      void playMedia(videoEl)
      void playMedia(audioEl)
    })
    simli.on('stop', finish)
    simli.on('error', (detail: string) => console.warn('[live] simli error', detail))
    simli.on('startup_error', (msg: string) => console.warn('[live] simli startup error', msg))
    await withTimeout(simli.start(), 40000, 'Video stream')
    if (!alive || stale()) throw new Error('Connect cancelled')
    void playMedia(videoEl)
    void playMedia(audioEl)

    queue = new SpeechQueue(simli, start.speechTicket, languageCode, handlers, () => alive && !stale())
    const q = queue

    handlers.onStatus('Listening…')
    let currentResponse = ''
    let textBuffer = ''
    const cancelled = new Set<string>()
    let responseActive = false
    let sendEvent: (e: object) => void = () => {}

    const flush = (final: boolean) => {
      const { sentences, rest } = takeSentences(textBuffer)
      for (const s of sentences) q.speak(s)
      textBuffer = rest
      if (final && textBuffer.trim()) {
        q.speak(textBuffer)
        textBuffer = ''
      }
    }

    let listener: { pc: RTCPeerConnection; dc: RTCDataChannel } | null = null
    try {
      listener = await connectListener({
      token: start.realtimeToken,
      mic,
      onOpen: (send) => {
        sendEvent = send
        send({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: '(The call just connected. Greet me now.)' }],
          },
        })
        send({ type: 'response.create' })
      },
      onClosed: finish,
      onEvent: (e) => {
        if (!alive) return
        switch (e.type) {
          case 'response.created':
            currentResponse = e.response?.id || ''
            responseActive = true
            textBuffer = ''
            break
          case 'response.output_text.delta':
          case 'response.text.delta': {
            const id = e.response_id || currentResponse
            if (cancelled.has(id)) break
            textBuffer += e.delta || ''
            flush(false)
            break
          }
          case 'response.output_text.done':
          case 'response.text.done': {
            const id = e.response_id || currentResponse
            if (!cancelled.has(id)) flush(true)
            break
          }
          case 'response.done':
            responseActive = false
            if (!cancelled.has(e.response?.id || currentResponse)) flush(true)
            textBuffer = ''
            break
          case 'input_audio_buffer.speech_started':
            // Barge-in: the visitor is talking — the face stops mid-sentence.
            if (q.busy || responseActive) {
              if (currentResponse) cancelled.add(currentResponse)
              if (responseActive) sendEvent({ type: 'response.cancel' })
              q.interrupt()
              textBuffer = ''
            }
            break
          case 'error':
            if (!/no active response|cancellation failed/i.test(e.error?.message || '')) {
              console.warn('[live] listener error', e.error)
            }
            break
          default:
            break
        }
      },
    })
    } catch (listenError) {
      if ((listenError as Error)?.name !== 'ListeningUnavailable') throw listenError
      handlers.onStatus('Listening…')
      stopBrowser = listenInBrowser({
        ticket: start.speechTicket,
        languageCode,
        queue: q,
        mic,
        alive: () => alive && !stale(),
        onFail: (message) => { if (alive && !stale()) console.warn('[live] browser listen', message) },
      })
    }
    pc = listener?.pc ?? null
    dc = listener?.dc ?? null
    if (!alive || stale()) throw new Error('Connect cancelled')

    handlers.onStatus('')
    return session
  } catch (e) {
    if (activeSession === session) activeSession = null
    await stop()
    throw e
  }
}
