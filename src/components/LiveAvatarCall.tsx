import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, AnamEvent, MessageRole } from '@anam-ai/js-sdk'
import type { AnamClient, MessageStreamEvent } from '@anam-ai/js-sdk'
import { avatarApi } from '../lib/api'
import {
  ensureAnamSlotFree,
  registerAnamClient,
  stopActiveAnamSession,
  unregisterAnamClient,
  withTimeout,
} from '../lib/anamSessionGate'

const C = { line: '#ddccb0', terra: '#c06a44' }
const sans = "'Hanken Grotesk', system-ui, sans-serif"
const serif = "'Newsreader', Georgia, serif"

export type LiveCallPhase = 'idle' | 'connecting' | 'live' | 'ended' | 'error'

function isConcurrentLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /429|concurrent session|Concurrency limit|Too Many Requests/i.test(msg)
}

function isBadRequestError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /400|Bad Request|Invalid request|Validation|voiceGenerationOptions/i.test(msg)
}

function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /Failed to fetch|NetworkError|CONNECTION_RESET|Load failed|network/i.test(msg)
}

function friendlyAnamError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (isConcurrentLimitError(e)) {
    return 'Previous session still closing. Wait a few seconds — Try again will reconnect automatically.'
  }
  if (isBadRequestError(e)) {
    return 'Could not start the live session. Restart the backend server and try again.'
  }
  if (isNetworkError(e)) {
    return 'Lost connection to the server — it may have restarted. Wait a few seconds and tap Try again.'
  }
  if (/timed out/i.test(msg)) {
    return `${msg}. Tap Try again.`
  }
  if (/402|plan|usage limit|Spend cap/i.test(msg)) {
    return 'Live session limit reached. Wait a moment and try again.'
  }
  if (/Anam|HeyGen|OpenAI|ElevenLabs/i.test(msg)) {
    return 'Could not start the live call. Please try again in a moment.'
  }
  return msg || 'Could not start the live call'
}

function tuneLiveVideoElement(videoId: string) {
  const el = document.getElementById(videoId) as HTMLVideoElement | null
  if (!el) return
  el.playsInline = true
  el.setAttribute('playsinline', 'true')
  el.setAttribute('webkit-playsinline', 'true')
  el.disablePictureInPicture = true
  // Prefer smoother playback over perfect A/V sync when the decoder is under load.
  try {
    ;(el as HTMLVideoElement & { playsInline: boolean }).playsInline = true
    if ('latencyHint' in el) (el as HTMLVideoElement & { latencyHint?: string }).latencyHint = 'realtime'
  } catch { /* ignore */ }
}

function wireAnamClient(
  connected: AnamClient,
  stale: () => boolean,
  onEnded: () => void,
  onCaption: (text: string) => void,
  onVideoReady: () => void,
  videoId: string,
) {
  connected.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => { if (!stale()) onVideoReady() })
  connected.addListener(AnamEvent.VIDEO_STREAM_STARTED, (stream: MediaStream) => {
    if (!stale()) onVideoReady()
    tuneLiveVideoElement(videoId)
    const track = stream.getVideoTracks()[0]
    try {
      // Hint the browser encoder/decoder path that motion smoothness matters more than still detail.
      if (track && 'contentHint' in track) track.contentHint = 'motion'
    } catch { /* ignore */ }
    const { width, height } = track?.getSettings?.() ?? {}
    if (width && height) console.info(`[Anam] video stream ${width}×${height}`)
  })
  connected.addListener(AnamEvent.CONNECTION_CLOSED, () => { if (!stale()) onEnded() })
  connected.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (e: MessageStreamEvent) => {
    if (!stale() && e?.role === MessageRole.PERSONA && e.content) onCaption(e.content)
  })
}

function armVideoReadyWatch(
  videoId: string,
  onReady: () => void,
  stale: () => boolean,
): () => void {
  const mark = () => { if (!stale()) onReady() }
  const el = document.getElementById(videoId) as HTMLVideoElement | null
  if (el && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) mark()
  el?.addEventListener('playing', mark, { once: true })
  el?.addEventListener('loadeddata', mark, { once: true })
  const timer = window.setTimeout(mark, 2000)
  return () => {
    window.clearTimeout(timer)
    el?.removeEventListener('playing', mark)
    el?.removeEventListener('loadeddata', mark)
  }
}

async function connectAnam(
  creatorId: string | undefined,
  videoId: string,
  stale: () => boolean,
  onStatus?: (msg: string) => void,
): Promise<{ client: AnamClient; usingOwnVoice: boolean }> {
  onStatus?.('Closing any previous session…')
  await ensureAnamSlotFree(6000)
  if (stale()) throw new Error('Connect cancelled')

  onStatus?.('Starting live session…')
  const { sessionToken, usingOwnVoice } = await withTimeout(
    avatarApi.startLive(creatorId),
    30000,
    'Starting live session',
  )
  if (stale()) throw new Error('Connect cancelled')
  if (!usingOwnVoice) {
    throw new Error(
      'Your voice was not cloned successfully. Re-record in Avatar Studio and generate the live avatar again — Live Call will not use a stock voice.',
    )
  }

  const client = createClient(sessionToken)
  registerAnamClient(client)

  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  if (stale()) throw new Error('Connect cancelled')

  if (!document.getElementById(videoId)) {
    unregisterAnamClient(client)
    throw new Error('Video element not ready')
  }

  const maxStreamAttempts = 4
  let lastError: unknown

  for (let streamAttempt = 0; streamAttempt < maxStreamAttempts; streamAttempt++) {
    if (stale()) throw new Error('Connect cancelled')
    if (streamAttempt > 0) {
      onStatus?.('Waiting for session slot…')
      await ensureAnamSlotFree(8000 + streamAttempt * 4000, client)
      registerAnamClient(client)
      if (stale()) throw new Error('Connect cancelled')
    }

    try {
      onStatus?.('Connecting video…')
      tuneLiveVideoElement(videoId)
      await withTimeout(client.streamToVideoElement(videoId), 45000, 'Video stream')
      tuneLiveVideoElement(videoId)
      return { client, usingOwnVoice }
    } catch (e) {
      lastError = e
      if (stale()) throw e
      if (!isConcurrentLimitError(e) || streamAttempt === maxStreamAttempts - 1) throw e
      await client.stopStreaming?.().catch(() => {})
    }
  }

  throw lastError
}

/** connectKey > 0 starts a session; increment to retry; 0 disconnects. */
export function useAnamLiveCall(creatorId: string | undefined, videoId: string, connectKey: number) {
  const clientRef = useRef<AnamClient | null>(null)
  const attemptRef = useRef(0)
  const [phase, setPhase] = useState<LiveCallPhase>(connectKey > 0 ? 'connecting' : 'idle')
  const [videoReady, setVideoReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [ownVoice, setOwnVoice] = useState(true)
  const [retryKey, setRetryKey] = useState(0)
  const [statusNote, setStatusNote] = useState('')

  const retry = useCallback(() => {
    setError(null)
    setVideoReady(false)
    setPhase('connecting')
    setStatusNote('Closing previous session…')
    void stopActiveAnamSession(6000).finally(() => setRetryKey((n) => n + 1))
  }, [])

  useEffect(() => {
    if (connectKey <= 0) {
      setPhase('idle')
      setVideoReady(false)
      setError(null)
      setCaption('')
      return
    }

    const attemptId = ++attemptRef.current
    let disarmVideoReady = () => {}
    const stale = () => attemptId !== attemptRef.current

    setPhase('connecting')
    setVideoReady(false)
    setError(null)
    setCaption('')
    setStatusNote('Closing any previous session…')

    void (async () => {
      try {
        const { client, usingOwnVoice } = await connectAnam(
          creatorId,
          videoId,
          stale,
          (msg) => { if (!stale()) setStatusNote(msg) },
        )
        if (stale()) {
          unregisterAnamClient(client)
          await client.stopStreaming?.()
          return
        }

        clientRef.current = client
        setOwnVoice(usingOwnVoice)
        setStatusNote('')
        setPhase('live')
        disarmVideoReady = armVideoReadyWatch(videoId, () => setVideoReady(true), stale)
        wireAnamClient(
          client,
          stale,
          () => {
            setVideoReady(false)
            setPhase('ended')
          },
          (text) => setCaption(text),
          () => setVideoReady(true),
          videoId,
        )
      } catch (e) {
        if (stale()) return
        const msg = e instanceof Error ? e.message : String(e)
        if (msg === 'Connect cancelled') return
        setError(friendlyAnamError(e))
        setPhase('error')
      }
    })()

    return () => {
      attemptRef.current++
      disarmVideoReady()
      const c = clientRef.current
      clientRef.current = null
      void ensureAnamSlotFree(6000, c)
    }
  }, [creatorId, videoId, connectKey, retryKey])

  const hangUp = useCallback(async () => {
    attemptRef.current++
    const c = clientRef.current
    clientRef.current = null
    setVideoReady(false)
    setStatusNote('Closing session…')
    await ensureAnamSlotFree(6000, c)
    setStatusNote('')
    setPhase('ended')
  }, [])

  return { phase, videoReady, error, statusNote, caption, ownVoice, hangUp, retry }
}

const VIDEO_ID = 'anam-persona-video'

interface Props {
  creatorId?: string
  name?: string
  onClose: () => void
}

/** Full-screen live call overlay. Prefer inline portrait embed on LegacyAvatar. */
export default function LiveAvatarCall({ creatorId, name = 'your legacy', onClose }: Props) {
  const live = useAnamLiveCall(creatorId, VIDEO_ID, 1)

  const hangUp = async () => {
    await live.hangUp()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d0b09', zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: sans }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0d0b09' }}>
        <video
          id={VIDEO_ID}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#0d0b09' }}
        />

        {live.phase === 'connecting' && (
          <Overlay>
            <div style={{ fontFamily: serif, fontSize: 24 }}>Connecting to {name}…</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>Bringing the live avatar to life</div>
          </Overlay>
        )}

        {live.phase === 'error' && (
          <Overlay>
            <div style={{ fontFamily: serif, fontSize: 22, color: '#ffb4a3' }}>Live call couldn’t start</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 10, maxWidth: 460, textAlign: 'center' }}>{live.error}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button style={btn(C.terra)} onClick={() => void live.retry()}>Try again</button>
              <button style={btn('#3a322a')} onClick={onClose}>Close</button>
            </div>
          </Overlay>
        )}

        {live.phase === 'live' && live.caption && (
          <div className="legacy-live-call-captions" style={{ position: 'absolute', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'center', padding: '0 24px' }}>
            <div style={{ background: 'rgba(0,0,0,.55)', color: '#fff', padding: '10px 18px', borderRadius: 12, fontSize: 16, maxWidth: 720, textAlign: 'center', backdropFilter: 'blur(4px)' }}>
              {live.caption}
            </div>
          </div>
        )}

      </div>

      <LiveCallControls onEnd={hangUp} />
    </div>
  )
}

export function LiveCallControls({
  onEnd,
  compact = false,
}: {
  onEnd: () => void | Promise<void>
  compact?: boolean
}) {
  const size = compact ? 44 : 52
  return (
    <div className="legacy-live-call-controls" style={{
      display: 'flex',
      justifyContent: 'center',
      padding: compact ? '12px 0 0' : '18px',
      background: compact ? 'transparent' : '#16120e',
    }}>
      <button
        type="button"
        aria-label="Stop live call"
        onClick={() => void onEnd()}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#e0563f',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(224,86,63,.42)',
          flexShrink: 0,
        }}
      />
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 6 }}>
      {children}
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '11px 20px',
    fontFamily: sans,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}
