import { useCallback, useEffect, useRef, useState } from 'react'
import { avatarApi, uploadMedia, type AvatarAssets } from '../lib/api'
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
        <li>Voice sample (about a minute) → cloned automatically</li>
        <li>A clear photo of your face → registered as your avatar automatically</li>
        <li>Preview video speaks in your cloned voice</li>
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
      const result = await avatarApi.cloneVoice(path)
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
      <p style={{ fontSize: 14, color: C.ink2, marginTop: 8 }}>Read these lines slowly and naturally. Aim for 30–90 seconds in a quiet room.</p>
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 18px', marginTop: 12 }}>
        {VOICE_SCRIPT.map((l, i) => (
          <p key={i} style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.5, color: C.ink, margin: i ? '10px 0 0' : 0 }}>{l}</p>
        ))}
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
const PORTRAIT_MIN_PX = 1024
const PORTRAIT_TARGET_PX = 1536

function PhotoStep({ creatorId, onDone, onBack }: { creatorId: string; onDone: () => void | Promise<void>; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [live, setLive] = useState(false)
  const [shot, setShot] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); if (url) URL.revokeObjectURL(url) }, [url])

  const startCamera = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1920, min: 1280 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setLive(true)
    } catch {
      setError('Camera permission is needed. You can also upload a photo instead.')
    }
  }

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const vw = v.videoWidth
    const vh = v.videoHeight
    const crop = Math.min(vw, vh)
    const out = Math.min(Math.max(crop, PORTRAIT_MIN_PX), PORTRAIT_TARGET_PX)
    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(v, (vw - crop) / 2, (vh - crop) / 2, crop, crop, 0, 0, out, out)
    canvas.toBlob((b) => {
      if (!b) return
      setShot(b); setUrl(URL.createObjectURL(b))
      streamRef.current?.getTracks().forEach((t) => t.stop())
      setLive(false)
    }, 'image/jpeg', 0.95)
  }

  const loadImage = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read that image'))
      img.src = URL.createObjectURL(file)
    })

  const normalizePortrait = async (file: File): Promise<Blob> => {
    const img = await loadImage(file)
    const crop = Math.min(img.width, img.height)
    const out = Math.min(Math.max(crop, PORTRAIT_MIN_PX), PORTRAIT_TARGET_PX)
    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, (img.width - crop) / 2, (img.height - crop) / 2, crop, crop, 0, 0, out, out)
    URL.revokeObjectURL(img.src)
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process photo'))), 'image/jpeg', 0.95)
    })
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    try {
      const normalized = await normalizePortrait(f)
      setShot(normalized)
      setUrl(URL.createObjectURL(normalized))
    } catch {
      setError('Could not use that photo — try a JPG or PNG with your face centered.')
    }
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
      <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 26, margin: 0 }}>Take your photo</h2>
      <p style={{ fontSize: 14, color: C.ink2, marginTop: 8 }}>
        Face the light, center your face, and look at the camera. For the sharpest live avatar, upload a high-resolution photo from your phone (1024px+).
      </p>

      <div className="legacy-photo-preview" style={{ width: 280, height: 280, borderRadius: 14, overflow: 'hidden', background: '#e4d8c2', margin: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {url ? (
          <img src={url} alt="portrait" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: live ? 'block' : 'none' }} />
        )}
        {!live && !url && <span style={{ fontFamily: serif, fontStyle: 'italic', color: C.ink3 }}>Camera off</span>}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {!live && !url && <button style={primaryBtn} onClick={startCamera}>Open camera</button>}
        {live && <button style={primaryBtn} onClick={capture}>Capture</button>}
        {url && <button style={ghostBtn} onClick={() => { setShot(null); setUrl(null); startCamera() }}>Retake</button>}
        <label style={{ ...ghostBtn, display: 'inline-block' }}>
          Upload instead
          <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        </label>
      </div>

      {error && !busy && <p style={{ color: '#b04a3a', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {busy && <StudioProgress label="Saving your photo…" />}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={ghostBtn} onClick={onBack} disabled={busy}>← Back</button>
        {!busy && (
          <button
            style={{ ...primaryBtn, opacity: shot ? 1 : 0.5, pointerEvents: shot ? 'auto' : 'none' }}
            onClick={() => void submit()}
          >
            Use this & continue
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
        setNotice('Your live avatar is ready. Go to your legacy page to talk face to face in real time.')
        setStatus('done')
        return
      }
      setError('Live avatar setup did not finish. Try again in a moment.')
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
        We're building your live avatar from your photo and voice. This usually takes about a minute —
        then family can talk with you face to face in real time.
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

