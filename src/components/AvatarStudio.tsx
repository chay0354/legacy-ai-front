import { useCallback, useEffect, useRef, useState } from 'react'
import { avatarApi, uploadMedia, type AvatarAssets } from '../lib/api'
import { ANAM_LANGUAGES, normalizeAnamLanguage } from '../lib/anamLanguages'
import { blobToWav, createMediaRecorder, VOICE_SCRIPT } from '../lib/voiceRecord'

const C = {
  paper: '#ece3d2', card: '#fbf6ec', ink: '#2b241c', ink2: '#6e6253', ink3: '#9a8d79',
  line: '#ddccb0', terra: '#c06a44', umber: '#7a5236', gold: '#b3902f', sage: '#71805c',
}
const serif = "'Newsreader', Georgia, serif"
const sans = "'Hanken Grotesk', system-ui, sans-serif"
const mono = "'Spline Sans Mono', ui-monospace, monospace"

const primaryBtn: React.CSSProperties = { background: C.ink, color: C.paper, border: 'none', borderRadius: 999, padding: '13px 26px', fontFamily: sans, fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { background: 'transparent', border: `1px solid ${C.line}`, color: C.ink2, borderRadius: 999, padding: '12px 22px', fontFamily: sans, fontWeight: 500, fontSize: 14, cursor: 'pointer' }
const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '26px 28px' }

type StepId = 'intro' | 'voice' | 'photo' | 'generate'
const STEPS: { id: StepId; label: string }[] = [
  { id: 'voice', label: 'Voice' },
  { id: 'photo', label: 'Photo' },
  { id: 'generate', label: 'Live avatar' },
]

interface Props {
  onExit: () => void
}

export default function AvatarStudio({ onExit }: Props) {
  const [step, setStep] = useState<StepId>('intro')
  const [creatorId, setCreatorId] = useState<string | null>(null)
  const [assets, setAssets] = useState<AvatarAssets | null>(null)
  const [voiceCloned, setVoiceCloned] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    avatarApi.getAssets()
      .then((r) => { setCreatorId(r.creatorId); setAssets(r.assets); setVoiceCloned(r.voiceCloned ?? null) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load avatar studio'))
      .finally(() => setLoading(false))
  }, [])

  const refresh = useCallback(async () => {
    const r = await avatarApi.getAssets()
    setCreatorId(r.creatorId)
    setAssets(r.assets)
    setVoiceCloned(r.voiceCloned ?? null)
  }, [])

  if (loading) return <Centered>Preparing the studio…</Centered>
  if (error) return <Centered><strong>{error}</strong><button style={primaryBtn} onClick={onExit}>Back</button></Centered>
  if (!creatorId) {
    return (
      <Centered>
        <strong>Finish your interview first</strong>
        <p style={{ color: C.ink2, maxWidth: 420, textAlign: 'center' }}>Your legacy needs to exist before we can build its avatar.</p>
        <button style={primaryBtn} onClick={onExit}>Back</button>
      </Centered>
    )
  }

  const currentIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="legacy-studio" style={{ minHeight: '100dvh', background: C.paper, fontFamily: sans, color: C.ink }}>
      <div className="legacy-studio-inner" style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: C.ink3 }}>Avatar Studio</div>
          <button style={ghostBtn} onClick={onExit}>Exit</button>
        </div>

        {step !== 'intro' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 4, borderRadius: 2, background: i <= currentIndex ? C.terra : C.line }} />
                <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: i === currentIndex ? C.ink : C.ink3, marginTop: 8 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 26 }}>
          {step === 'intro' && <Intro assets={assets} voiceCloned={voiceCloned} onStart={() => setStep('voice')} />}
          {step === 'voice' && (
            <VoiceStep creatorId={creatorId} assets={assets} onDone={async () => { await refresh(); setStep('photo') }} />
          )}
          {step === 'photo' && (
            <PhotoStep creatorId={creatorId} onDone={async () => { await refresh(); setStep('generate') }} onBack={() => setStep('voice')} />
          )}
          {step === 'generate' && (
            <GenerateVideoStep
              onDone={onExit}
              onBack={() => setStep('photo')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.paper, fontFamily: sans, color: C.ink, gap: 14, padding: '0 24px' }}>
      {children}
    </div>
  )
}

function Intro({ assets, voiceCloned, onStart }: { assets: AvatarAssets | null; voiceCloned: boolean | null; onStart: () => void }) {
  const hasVoice = assets?.voice_status === 'ready'
  const cloned = voiceCloned === true
  return (
    <div style={card}>
      <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 34, margin: 0 }}>Create your living avatar</h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: C.ink2, marginTop: 12 }}>
        Record your <strong>voice</strong> and take a <strong>photo</strong>. The system automatically
        clones your voice and builds a talking avatar from your face — no extra steps on other websites.
      </p>
      <ul style={{ fontSize: 14, lineHeight: 1.9, color: C.ink2, marginTop: 8 }}>
        <li>Choose your speaking language, then record a voice sample → cloned automatically</li>
        <li>A clear <strong>front-facing</strong> photo (face + shoulders) → built into your live avatar</li>
        <li>Then family can talk with you face to face in real time</li>
      </ul>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
        <button style={primaryBtn} onClick={onStart}>{hasVoice ? 'Update my avatar' : 'Begin'}</button>
        {cloned && <span style={{ fontFamily: mono, fontSize: 11, color: C.sage }}>✓ your voice is cloned</span>}
        {hasVoice && !cloned && <span style={{ fontFamily: mono, fontSize: 11, color: '#b04a3a' }}>⚠ voice not cloned — re-record in Voice step</span>}
      </div>
      <p style={{ fontSize: 12, color: C.ink3, marginTop: 16 }}>You’ll be asked for microphone and camera permission. Nothing is shared — only you and people you invite can see it.</p>
    </div>
  )
}

function StudioProgress({ label }: { label: string }) {
  return (
    <div style={{ marginTop: 20, padding: '20px 22px', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
      <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: C.terra }}>{label}</div>
      <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: C.line, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '40%', background: C.terra, animation: 'legacyPulse 1.4s ease-in-out infinite alternate' }} />
      </div>
      <style>{`@keyframes legacyPulse { from { margin-left: 0; width: 20%; } to { margin-left: 60%; width: 35%; } }`}</style>
    </div>
  )
}

/* ------------------------------- Voice step ------------------------------ */
function VoiceStep({ creatorId, assets, onDone }: { creatorId: string; assets: AvatarAssets | null; onDone: () => void | Promise<void> }) {
  const [language, setLanguage] = useState(() =>
    normalizeAnamLanguage(typeof assets?.metadata?.anam_language === 'string' ? assets.metadata.anam_language : 'en'),
  )
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [recordedSeconds, setRecordedSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const secondsRef = useRef(0)

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
    if (timerRef.current) clearInterval(timerRef.current)
    recRef.current?.stop()
  }, [url])

  const start = async () => {
    setError(null)
    setBlob(null)
    setRecordedSeconds(0)
    if (url) {
      URL.revokeObjectURL(url)
      setUrl(null)
    }
    try {
      if (typeof MediaRecorder === 'undefined') {
        setError('Voice recording is not supported in this browser. Try Chrome or Edge on desktop.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const { recorder: rec, mimeType } = createMediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const duration = secondsRef.current
        const b = new Blob(chunksRef.current, { type: mimeType })
        if (!b.size) {
          setError('No audio was captured — try again and speak while the timer runs.')
          setRecordedSeconds(0)
          return
        }
        setBlob(b)
        setRecordedSeconds(duration)
        setUrl(URL.createObjectURL(b))
      }
      recRef.current = rec
      rec.start(250)
      setRecording(true)
      setSeconds(0)
      secondsRef.current = 0
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1
          secondsRef.current = next
          return next
        })
      }, 1000)
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone permission is needed. Allow the mic in your browser, then try again.')
      } else if (name === 'NotFoundError') {
        setError('No microphone found. Plug one in or check your system sound settings.')
      } else {
        setError('Could not start recording. Try refreshing the page.')
      }
    }
  }

  const stop = () => {
    const rec = recRef.current
    if (rec && rec.state === 'recording') {
      try { rec.requestData() } catch { /* optional */ }
      rec.stop()
    }
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const submit = async () => {
    if (!blob || busy) return
    if (recordedSeconds < 5) {
      setError('Record at least 5 seconds — aim for 30–90 seconds for best voice cloning.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const wav = await blobToWav(blob)
      const path = await uploadMedia(creatorId, 'voice-sample', wav, 'wav', 'audio/wav')
      const result = await avatarApi.cloneVoice(path, language)
      if (!result.cloned) {
        setError('Voice cloning did not succeed. Try again with a longer recording (30+ seconds) in a quiet room.')
        setBusy(false)
        return
      }
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clone your voice')
      setBusy(false)
    }
  }

  const canSubmit = Boolean(blob && blob.size > 0) && !recording && recordedSeconds >= 5

  return (
    <div style={card}>
      <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 26, margin: 0 }}>Record your voice</h2>
      <p style={{ fontSize: 14, color: C.ink2, marginTop: 8 }}>
        Choose the language you’ll speak, then read these lines slowly and naturally. Aim for 30–90 seconds in a quiet room.
      </p>

      <label style={{ display: 'block', marginTop: 16 }}>
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: C.ink3 }}>
          Language for your live avatar voice
        </span>
        <select
          value={language}
          onChange={(e) => setLanguage(normalizeAnamLanguage(e.target.value))}
          disabled={recording || busy}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 360,
            marginTop: 8,
            padding: '12px 14px',
            borderRadius: 10,
            border: `1px solid ${C.line}`,
            background: C.paper,
            color: C.ink,
            fontFamily: sans,
            fontSize: 15,
          }}
        >
          {ANAM_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
        <span style={{ display: 'block', fontSize: 12.5, color: C.ink3, marginTop: 8, lineHeight: 1.45, maxWidth: 480 }}>
          Only languages Anam supports. Record in this language so Live Call matches your accent.
        </span>
      </label>

      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 18px', marginTop: 16 }}>
        {language === 'en' ? (
          VOICE_SCRIPT.map((l, i) => (
            <p key={i} style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.5, color: C.ink, margin: i ? '10px 0 0' : 0 }}>{l}</p>
          ))
        ) : (
          <p style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.55, color: C.ink, margin: 0 }}>
            Speak naturally for 30–90 seconds in{' '}
            <strong>{ANAM_LANGUAGES.find((l) => l.code === language)?.label || language}</strong>
            — introduce yourself, talk about your family, a childhood memory, and something you care about.
            Clear speech in a quiet room works best for cloning.
          </p>
        )}
      </div>

      <div className="legacy-voice-controls" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
        {!recording && (
          <button style={primaryBtn} onClick={start}>{blob ? 'Re-record' : 'Start recording'}</button>
        )}
        {recording && (
          <button style={{ ...primaryBtn, background: C.terra }} onClick={stop}>■ Stop ({seconds}s)</button>
        )}
        {recording && <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.terra, animation: 'none' }} />}
        {url && !recording && <audio src={url} controls style={{ height: 36 }} />}
      </div>

      {assets?.voice_status === 'ready' && !blob && (
        <p style={{ fontFamily: mono, fontSize: 11, color: assets.metadata?.cloned === false ? '#b04a3a' : C.sage, marginTop: 12 }}>
          {assets.metadata?.cloned === false
            ? '⚠ Voice is not cloned yet — re-record here (30+ seconds, quiet room).'
            : '✓ Your cloned voice is saved. Re-recording replaces it.'}
        </p>
      )}
      {error && !busy && <p style={{ color: '#b04a3a', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {busy && <StudioProgress label="Cloning your voice…" />}

      {blob && !recording && recordedSeconds < 5 && !busy && (
        <p style={{ fontFamily: sans, fontSize: 12, color: C.ink3, marginTop: 12 }}>
          Record at least 5 seconds to continue (30+ seconds recommended for voice cloning).
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        {!busy && (
          <button
            type="button"
            style={{ ...primaryBtn, opacity: canSubmit ? 1 : 0.5 }}
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            Use this & continue
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- Photo step ------------------------------ */
/** Anam Cara best practices: square ≥1152px with head, shoulders, and upper chest. */
const PORTRAIT_MIN_PX = 1152
const PORTRAIT_TARGET_PX = 1536
const PORTRAIT_HARD_MIN_PX = 720

const PHOTO_TIPS = [
  'Center your face inside the oval outline',
  'Look straight at the camera — both eyes visible',
  'Keep head, shoulders, and upper chest in frame',
  'Neutral expression, even lighting, plain background',
]

function portraitOutputSize(sourcePx: number): number {
  if (sourcePx < PORTRAIT_HARD_MIN_PX) return sourcePx
  return Math.min(Math.max(sourcePx, PORTRAIT_MIN_PX), PORTRAIT_TARGET_PX)
}

function PhotoStep({ creatorId, onDone, onBack }: { creatorId: string; onDone: () => void | Promise<void>; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const urlRef = useRef<string | null>(null)
  const [live, setLive] = useState(false)
  const [starting, setStarting] = useState(true)
  const [shot, setShot] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setLive(false)
  }

  const startCamera = useCallback(async () => {
    setError(null)
    setHint(null)
    setStarting(true)
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support webcam access. Try Chrome or Edge on HTTPS / localhost.')
      }

      // Soft constraints first — hard min 1280×1280 fails on most laptop cams (often 1280×720).
      const attempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        { video: true, audio: false },
      ]

      let stream: MediaStream | null = null
      let lastErr: unknown = null
      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          break
        } catch (err) {
          lastErr = err
        }
      }
      if (!stream) throw lastErr ?? new Error('Could not open camera')

      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        // Some browsers need the element visible before play() resolves.
        video.style.display = 'block'
        await video.play()
      }
      setLive(true)
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      const msg = err instanceof Error ? err.message : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Camera permission was blocked. Click the lock/camera icon in the address bar, allow the camera, then tap Enable camera.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No camera was found on this device.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setError('Camera is busy in another app. Close Zoom/Teams/etc., then tap Enable camera.')
      } else if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
        setError('Could not match a supported camera mode. Tap Enable camera to retry.')
      } else {
        setError(msg || 'Could not open the camera. Tap Enable camera to try again.')
      }
      setLive(false)
    } finally {
      setStarting(false)
    }
  }, [])

  useEffect(() => {
    void startCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [startCamera])

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const vw = v.videoWidth
    const vh = v.videoHeight
    const crop = Math.min(vw, vh)
    const out = portraitOutputSize(crop)
    if (crop < PORTRAIT_HARD_MIN_PX) {
      setError('Camera resolution is too low. Try a different camera or move closer in better light.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')!
    // Mirror to match the preview the user saw.
    ctx.translate(out, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(v, (vw - crop) / 2, (vh - crop) / 2, crop, crop, 0, 0, out, out)
    canvas.toBlob((b) => {
      if (!b) return
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const next = URL.createObjectURL(b)
      urlRef.current = next
      setShot(b)
      setUrl(next)
      setHint(crop < PORTRAIT_MIN_PX
        ? 'Captured. Check that your face fills the oval and your shoulders are visible.'
        : 'Looks good — confirm your face is centered before continuing.')
      stopCamera()
    }, 'image/jpeg', 0.95)
  }

  const retake = () => {
    setShot(null)
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setUrl(null)
    setHint(null)
    setError(null)
    void startCamera()
  }

  const submit = async () => {
    if (!shot || busy) return
    setBusy(true)
    setError(null)
    try {
      const ext = shot.type.includes('png') ? 'png' : 'jpg'
      const path = await uploadMedia(creatorId, 'portrait', shot, ext)
      await avatarApi.saveAssets({ portraitPath: path })
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your photo')
      setBusy(false)
    }
  }

  return (
    <div style={card}>
      <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 26, margin: 0 }}>Take your front-facing photo</h2>
      <p style={{ fontSize: 14, color: C.ink2, marginTop: 8, lineHeight: 1.55, maxWidth: 520 }}>
        Position your face inside the oval — like an ID verification photo. Looking straight at the camera
        with head and shoulders in frame gives the best likeness.
      </p>

      <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PHOTO_TIPS.map((tip) => (
          <li key={tip} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.4, color: C.ink2 }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: C.terra, marginTop: 6, flex: 'none' }} />
            <span>{tip}</span>
          </li>
        ))}
      </ul>

      <div
        className="legacy-photo-preview"
        style={{
          position: 'relative',
          width: 'min(100%, 360px)',
          aspectRatio: '1',
          borderRadius: 18,
          overflow: 'hidden',
          background: '#1a1612',
          margin: '20px 0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1px rgba(43,36,28,.12)',
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: live && !url ? 'block' : 'none',
            transform: 'scaleX(-1)',
          }}
        />
        {url && (
          <img
            src={url}
            alt="Front-facing portrait preview"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {/* KYC-style face guide — only while live camera is on */}
        {live && !url && (
          <>
            <svg
              aria-hidden
              viewBox="0 0 360 360"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              <defs>
                <mask id="kyc-face-mask">
                  <rect width="360" height="360" fill="white" />
                  <ellipse cx="180" cy="155" rx="108" ry="132" fill="black" />
                </mask>
              </defs>
              <rect width="360" height="360" fill="rgba(10,8,6,.62)" mask="url(#kyc-face-mask)" />
              <ellipse
                cx="180"
                cy="155"
                rx="108"
                ry="132"
                fill="none"
                stroke="rgba(251,246,236,.95)"
                strokeWidth="2.5"
              />
              {/* Soft shoulder guide line */}
              <path
                d="M78 292 C120 262, 240 262, 282 292"
                fill="none"
                stroke="rgba(251,246,236,.35)"
                strokeWidth="1.5"
                strokeDasharray="5 6"
              />
            </svg>
            <div
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                left: 12,
                right: 12,
                top: 14,
                textAlign: 'center',
                fontFamily: mono,
                fontSize: 11,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: '#fbf6ec',
                textShadow: '0 1px 4px rgba(0,0,0,.55)',
              }}
            >
              Align your face in the oval
            </div>
            <div
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 14,
                textAlign: 'center',
                fontFamily: sans,
                fontSize: 12.5,
                fontWeight: 500,
                color: 'rgba(251,246,236,.9)',
                textShadow: '0 1px 4px rgba(0,0,0,.55)',
              }}
            >
              Shoulders along the dashed line · look at the camera
            </div>
          </>
        )}

        {!live && !url && (
          <span style={{ fontFamily: serif, fontStyle: 'italic', color: 'rgba(251,246,236,.65)', padding: 24, textAlign: 'center' }}>
            {starting ? 'Starting camera…' : 'Camera unavailable'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {live && !url && (
          <button style={primaryBtn} onClick={capture}>
            Capture photo
          </button>
        )}
        {!live && !url && !starting && (
          <button style={primaryBtn} onClick={() => void startCamera()}>
            Enable camera
          </button>
        )}
        {url && (
          <button style={ghostBtn} onClick={retake} disabled={busy}>
            Retake
          </button>
        )}
      </div>

      {hint && !error && <p style={{ color: C.sage, fontSize: 13, marginTop: 12, lineHeight: 1.45 }}>{hint}</p>}
      {error && !busy && <p style={{ color: '#b04a3a', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {busy && <StudioProgress label="Saving your photo…" />}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={ghostBtn} onClick={onBack} disabled={busy}>← Back</button>
        {!busy && (
          <button
            style={{ ...primaryBtn, opacity: shot ? 1 : 0.5, pointerEvents: shot ? 'auto' : 'none' }}
            onClick={() => void submit()}
          >
            Use this photo
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------------- Live avatar provision (Anam) --------------- */
function GenerateVideoStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [phase, setPhase] = useState('Preparing…')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const started = useRef(false)

  const run = async () => {
    setStatus('generating')
    setError(null)
    setNotice(null)
    setPhase('Creating your live avatar…')
    try {
      const prov = await avatarApi.provision({
        onProgress: (p) => setPhase(p),
      })
      if (prov.liveReady) {
        setNotice('Your face and cloned voice are ready. Go to your legacy page to talk face to face in real time.')
        setStatus('done')
        return
      }
      setError(
        prov.assets?.metadata?.anam_error
        || 'Live avatar setup did not finish — your voice must be cloned successfully (no stock voice). Re-record your voice and try again.',
      )
      setStatus('error')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your live avatar')
      setStatus('error')
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    run()
  }, [])

  const retry = () => { run() }

  return (
    <div style={card}>
      <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 26, margin: 0 }}>Bringing your avatar to life</h2>
      <p style={{ fontSize: 14, color: C.ink2, marginTop: 8 }}>
        We're building your live avatar from your photo and cloning your voice. This usually takes about a minute.
        Live Call will only start once your own voice clone succeeds — we never use a stock voice.
      </p>

      {status === 'generating' && <StudioProgress label={phase} />}

      {status === 'done' && (
        <div style={{ margin: '20px 0', padding: '18px 20px', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: C.sage, marginBottom: 8 }}>✓ Live avatar ready</div>
          <p style={{ fontSize: 14, color: C.ink2, margin: 0, lineHeight: 1.5 }}>
            {notice || 'Your face and voice are set up. Use Live Call on your legacy page for a real-time conversation.'}
          </p>
        </div>
      )}

      {error && <p style={{ color: '#b04a3a', fontSize: 13, marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={ghostBtn} onClick={onBack} disabled={status === 'generating'}>← Back</button>
        {status === 'error' && <button style={primaryBtn} onClick={retry}>Try again</button>}
        {status === 'done' && <button style={primaryBtn} onClick={onDone}>Go to my legacy & talk →</button>}
      </div>
    </div>
  )
}

