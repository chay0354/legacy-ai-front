import { useEffect, useRef, useState } from 'react'
import { blobToWav, createMediaRecorder, VOICE_SCRIPT } from '../lib/voiceRecord'

const C = {
  card: '#fbf6ec',
  ink: '#2b241c',
  ink2: '#6e6253',
  ink3: '#9a8d79',
  line: '#ddccb0',
  terra: '#c06a44',
  sage: '#71805c',
}
const serif = "'Newsreader', Georgia, serif"
const sans = "'Hanken Grotesk', system-ui, sans-serif"

type Props = {
  open: boolean
  saving?: boolean
  error?: string | null
  hasExisting?: boolean
  onSave: (wav: Blob) => Promise<void>
  onClose: () => void
}

export default function VoiceRecordModal({
  open,
  saving = false,
  error,
  hasExisting = false,
  onSave,
  onClose,
}: Props) {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [recordedSeconds, setRecordedSeconds] = useState(0)
  const [localError, setLocalError] = useState<string | null>(null)
  const secondsRef = useRef(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!open) return
    setRecording(false)
    setBlob(null)
    setPreviewUrl(null)
    setSeconds(0)
    setRecordedSeconds(0)
    secondsRef.current = 0
    setLocalError(null)
  }, [open])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    recRef.current?.stop()
  }, [])

  if (!open) return null

  const start = async () => {
    setLocalError(null)
    setBlob(null)
    setPreviewUrl(null)
    setRecordedSeconds(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const { recorder: rec, mimeType } = createMediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const duration = secondsRef.current
        const b = new Blob(chunksRef.current, { type: mimeType })
        if (!b.size) {
          setLocalError('No audio was captured — try recording again.')
          setRecordedSeconds(0)
          return
        }
        setBlob(b)
        setRecordedSeconds(duration)
        setPreviewUrl(URL.createObjectURL(b))
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
    } catch {
      setLocalError('Microphone permission is needed to record your voice.')
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

  const handleSave = async () => {
    if (!blob || saving) return
    if (recordedSeconds < 2) {
      setLocalError('Record at least 2 seconds before saving.')
      return
    }
    setLocalError(null)
    try {
      const wav = await blobToWav(blob)
      await onSave(wav)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not save recording')
      throw e
    }
  }

  const canSave = Boolean(blob && blob.size > 0) && !recording && recordedSeconds >= 2
  const displayError = error || localError

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => { if (!saving) onClose() }}
      className="legacy-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(43,36,28,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="legacy-modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: '24px 26px',
          boxShadow: '0 24px 48px rgba(43,36,28,.18)',
        }}
      >
        <div style={{ fontFamily: serif, fontSize: 24, color: C.ink }}>Record your voice</div>
        <p style={{ fontFamily: sans, fontSize: 13, color: C.ink2, margin: '8px 0 18px', lineHeight: 1.5 }}>
          Record a message in your own voice. Family will hear it on your avatar page — separate from the live talking avatar.
        </p>

        <div style={{ background: '#ece3d2', border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 18px' }}>
          {VOICE_SCRIPT.map((line, i) => (
            <p key={i} style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.5, color: C.ink, margin: i ? '10px 0 0' : 0 }}>{line}</p>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
          {!recording && (
            <button
              type="button"
              disabled={saving}
              onClick={start}
              style={{
                border: 'none',
                cursor: saving ? 'default' : 'pointer',
                background: C.ink,
                color: C.card,
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 14,
                padding: '12px 22px',
                borderRadius: 999,
              }}
            >
              {blob ? 'Re-record' : 'Start recording'}
            </button>
          )}
          {recording && (
            <button
              type="button"
              onClick={stop}
              style={{
                border: 'none',
                cursor: 'pointer',
                background: C.terra,
                color: C.card,
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 14,
                padding: '12px 22px',
                borderRadius: 999,
              }}
            >
              ■ Stop ({seconds}s)
            </button>
          )}
          {recording && (
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.terra }} />
          )}
          {previewUrl && !recording && (
            <audio src={previewUrl} controls style={{ height: 36, maxWidth: '100%' }} />
          )}
        </div>

        {hasExisting && !blob && (
          <p style={{ fontFamily: sans, fontSize: 12, color: C.sage, marginTop: 12 }}>
            ✓ A voice recording is saved. Re-recording replaces what family hears on your avatar page.
          </p>
        )}

        {displayError && (
          <p style={{ color: '#b04a3a', fontSize: 13, marginTop: 12 }}>{displayError}</p>
        )}

        {blob && !recording && recordedSeconds < 2 && (
          <p style={{ fontFamily: sans, fontSize: 12, color: C.ink3, marginTop: 12 }}>
            Record at least 2 seconds to save.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            style={{
              border: `1px solid ${C.line}`,
              background: 'transparent',
              color: C.ink2,
              fontFamily: sans,
              fontWeight: 500,
              fontSize: 14,
              padding: '11px 20px',
              borderRadius: 999,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !canSave}
            onClick={() => void handleSave()}
            style={{
              border: 'none',
              background: C.terra,
              color: C.card,
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 14,
              padding: '11px 22px',
              borderRadius: 999,
              cursor: saving || !canSave ? 'not-allowed' : 'pointer',
              opacity: saving || !canSave ? 0.55 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save for avatar page'}
          </button>
        </div>
      </div>
    </div>
  )
}
