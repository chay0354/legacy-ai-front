import { useCallback, useEffect, useRef, useState } from 'react'
import { startLiveSession, stopActiveLiveSession, type LiveSession } from '../lib/liveCallSession'
import { textMatchesSessionLanguage } from '../lib/languageScript'
import { playMedia } from '../lib/playMedia'
import { T, radius, sans, serif } from '../design/tokens'

/** Keep captions to a spoken subtitle — never a wall of text over the face. */
const CAPTION_MAX_CHARS = 160

export type LiveCallPhase = 'idle' | 'connecting' | 'live' | 'ended' | 'error'

function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /Failed to fetch|NetworkError|CONNECTION_RESET|Load failed|network/i.test(msg)
}

function friendlyLiveError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const code = (e as { code?: string } | null)?.code
  if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotFoundError')) {
    return 'Allow microphone access in your browser to talk, then tap Try again.'
  }
  if (code === 'live_face_processing' || /still being created/i.test(msg)) {
    return 'The live face is still being created. This takes a few minutes — tap Try again shortly.'
  }
  if (isNetworkError(e)) {
    return 'Lost connection to the server — it may have restarted. Wait a few seconds and tap Try again.'
  }
  if (/timed out/i.test(msg)) {
    return `${msg}. Tap Try again.`
  }
  if (/MINUTES_REQUIRED|minutes are used|add 30 minutes/i.test(msg) || code === 'MINUTES_REQUIRED') {
    return 'Your minutes are used. Open Plan and purchases and add 30 minutes to keep calling.'
  }
  if (/402|plan|usage limit|Spend cap/i.test(msg)) {
    return 'This live call needs an active Package or Monthly plan.'
  }
  if (/Simli|OpenAI|ElevenLabs|Listening service|Too Many Retry|CONNECTION TIMED OUT/i.test(msg)) {
    return 'Could not start the live call. Please try again in a moment.'
  }
  return msg || 'Could not start the live call'
}

function clampCaption(text: string, maxChars = CAPTION_MAX_CHARS): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (t.length <= maxChars) return t
  return `${t.slice(0, maxChars - 1).trimEnd()}…`
}

function tuneLiveVideoElement(videoId: string) {
  const el = document.getElementById(videoId) as HTMLVideoElement | null
  if (!el) return el
  el.playsInline = true
  el.muted = true
  el.setAttribute('playsinline', 'true')
  el.setAttribute('webkit-playsinline', 'true')
  el.disablePictureInPicture = true
  return el
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
  const timer = window.setTimeout(mark, 2500)
  return () => {
    window.clearTimeout(timer)
    el?.removeEventListener('playing', mark)
    el?.removeEventListener('loadeddata', mark)
  }
}

/** Keep the face element playing if the browser pauses it (tab switch, autoplay hiccup). */
function armVideoPlayWatch(videoId: string, stale: () => boolean): () => void {
  const el = document.getElementById(videoId) as HTMLVideoElement | null
  if (!el) return () => {}
  const iv = window.setInterval(() => {
    if (stale() || el.ended) return
    if (el.paused && el.srcObject) void playMedia(el)
  }, 1000)
  return () => window.clearInterval(iv)
}

/** connectKey > 0 starts a session; increment to retry; 0 disconnects. */
export function useLiveCall(creatorId: string | undefined, videoId: string, connectKey: number) {
  const sessionRef = useRef<LiveSession | null>(null)
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
    setCaption('')
    setPhase('connecting')
    setStatusNote('Closing previous session…')
    void stopActiveLiveSession().finally(() => setRetryKey((n) => n + 1))
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
    let disarmPlayWatch = () => {}
    const stale = () => attemptId !== attemptRef.current

    setPhase('connecting')
    setVideoReady(false)
    setError(null)
    setCaption('')
    setStatusNote('Starting live session…')

    void (async () => {
      try {
        // Wait a frame so the <video> for this call is mounted.
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
        if (stale()) return
        const videoEl = tuneLiveVideoElement(videoId)
        if (!videoEl) throw new Error('Video element not ready')

        let languageCode = 'en'
        const session = await startLiveSession({
          creatorId,
          videoEl,
          stale,
          handlers: {
            onStatus: (msg) => { if (!stale()) setStatusNote(msg) },
            onVideoReady: () => { if (!stale()) setVideoReady(true) },
            onCaption: (text) => {
              if (stale()) return
              const next = clampCaption(text)
              // Language drift — hide mismatched script rather than flash it over the call.
              setCaption(textMatchesSessionLanguage(next, languageCode) ? next : '')
            },
            onCaptionClear: () => { if (!stale()) setCaption('') },
            onEnded: () => {
              if (stale()) return
              setVideoReady(false)
              setCaption('')
              setPhase('ended')
            },
          },
        })
        languageCode = session.languageCode
        if (stale()) {
          await session.stop()
          return
        }

        sessionRef.current = session
        setOwnVoice(true)
        setStatusNote('')
        setPhase('live')
        disarmVideoReady = armVideoReadyWatch(videoId, () => setVideoReady(true), stale)
        disarmPlayWatch = armVideoPlayWatch(videoId, stale)
      } catch (e) {
        if (stale()) return
        const msg = e instanceof Error ? e.message : String(e)
        if (msg === 'Connect cancelled') return
        setError(friendlyLiveError(e))
        setPhase('error')
      }
    })()

    return () => {
      attemptRef.current++
      disarmVideoReady()
      disarmPlayWatch()
      const s = sessionRef.current
      sessionRef.current = null
      void (s ? s.stop() : stopActiveLiveSession())
    }
  }, [creatorId, videoId, connectKey, retryKey])

  const hangUp = useCallback(async () => {
    attemptRef.current++
    const s = sessionRef.current
    sessionRef.current = null
    setVideoReady(false)
    setCaption('')
    setStatusNote('Closing session…')
    await (s ? s.stop() : stopActiveLiveSession())
    setStatusNote('')
    setPhase('ended')
  }, [])

  return { phase, videoReady, error, statusNote, caption, ownVoice, hangUp, retry }
}

const VIDEO_ID = 'live-persona-video'

interface Props {
  creatorId?: string
  name?: string
  onClose: () => void
}

/** Full-screen live call overlay. Prefer inline portrait embed on LegacyAvatar. */
export default function LiveAvatarCall({ creatorId, name = 'your legacy', onClose }: Props) {
  const live = useLiveCall(creatorId, VIDEO_ID, 1)

  const hangUp = async () => {
    await live.hangUp()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.walnutDeep, zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: sans }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: T.walnutDeep }}>
        <video
          id={VIDEO_ID}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', background: T.walnutDeep }}
        />

        {live.phase === 'connecting' && (
          <Overlay>
            <div style={{ fontFamily: serif, fontSize: 24 }}>Connecting to {name}…</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>{live.statusNote || 'Bringing the live avatar to life'}</div>
          </Overlay>
        )}

        {live.phase === 'error' && (
          <Overlay>
            <div style={{ fontFamily: serif, fontSize: 22, color: T.onDark }}>Live call couldn’t start</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 10, maxWidth: 460, textAlign: 'center' }}>{live.error}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button style={btn(T.sienna)} onClick={() => void live.retry()}>Try again</button>
              <button style={btn(T.walnutSoft)} onClick={onClose}>Close</button>
            </div>
          </Overlay>
        )}

        {live.phase === 'live' && live.caption && (
          <div className="legacy-live-call-captions" style={{ position: 'absolute', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'center', padding: '0 24px', pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(0,0,0,.55)',
              color: T.onDark,
              padding: '10px 18px',
              borderRadius: radius.card,
              fontSize: 16,
              lineHeight: 1.35,
              maxWidth: 520,
              maxHeight: '4.2em',
              overflow: 'hidden',
              textAlign: 'center',
              backdropFilter: 'blur(4px)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
            }}>
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
      background: compact ? 'transparent' : T.walnut,
    }}>
      <button
        type="button"
        aria-label="Stop live call"
        onClick={() => void onEnd()}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: T.error,
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
    color: T.onPrimary,
    border: 'none',
    borderRadius: radius.control,
    padding: '11px 20px',
    fontFamily: sans,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}
