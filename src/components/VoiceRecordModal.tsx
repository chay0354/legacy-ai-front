import { useEffect, useId, useRef, useState } from 'react'
import { blobToWav, CLONE_AUDIO_CONSTRAINTS, createMediaRecorder, MIN_VOICE_SECONDS, UNDER_30S_MESSAGE, voiceScript } from '../lib/voiceRecord'
import { T, heading, radius, sans, serif, shadow } from '../design/tokens'
import { useDialogA11y } from '../lib/useDialogA11y'

type Props = {
  open: boolean
  saving?: boolean
  error?: string | null
  hasExisting?: boolean
  speakerName?: string | null
  onSave: (wav: Blob) => Promise<void>
  onClose: () => void
}

export default function VoiceRecordModal({
  open,
  saving = false,
  error,
  hasExisting = false,
  speakerName,
  onSave,
  onClose,
}: Props) {
  const titleId = useId()
  const panelRef = useDialogA11y(open, onClose)
  const script = voiceScript(speakerName)
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: CLONE_AUDIO_CONSTRAINTS })
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
    if (recordedSeconds < MIN_VOICE_SECONDS) {
      setLocalError(UNDER_30S_MESSAGE)
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

  const canSave = Boolean(blob && blob.size > 0) && !recording && recordedSeconds >= MIN_VOICE_SECONDS
  const displayError = error || localError

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
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
        ref={panelRef}
        tabIndex={-1}
        className="legacy-modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          background: T.card,
          border: `1px solid ${T.line}`,
          borderRadius: radius.card,
          padding: '24px 26px',
          boxShadow: shadow.lift,
          outline: 'none',
        }}
      >
        <h2 id={titleId} style={{ fontFamily: serif, fontSize: 24, fontWeight: heading.weight, color: T.ink, margin: 0 }}>Record your voice</h2>
        <p style={{ fontFamily: sans, fontSize: 14, color: T.ink2, margin: '8px 0 18px', lineHeight: 1.5 }}>
          This recording clones your voice for the live avatar. It is not saved as a story. Read the passage slowly — at least 30 seconds, ideally 60–90 in a quiet room.
          {speakerName?.trim() ? ` Say “${speakerName.trim()}” where your name appears.` : ' Say your name clearly in the first line.'}
        </p>

        <div style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: radius.sm, padding: '16px 18px' }}>
          {script.map((line, i) => (
            <p key={i} style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.5, color: T.ink, margin: i ? '10px 0 0' : 0 }}>{line}</p>
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
                background: T.ink,
                color: T.onPrimary,
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 14,
                padding: '12px 22px',
                borderRadius: radius.control,
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
                background: T.sienna,
                color: T.onPrimary,
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 14,
                padding: '12px 22px',
                borderRadius: radius.control,
              }}
            >
              ■ Stop ({seconds}s)
            </button>
          )}
          {recording && (
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.sienna }} />
          )}
          {previewUrl && !recording && (
            <audio src={previewUrl} controls style={{ height: 36, maxWidth: '100%' }} />
          )}
        </div>

        {hasExisting && !blob && (
          <p style={{ fontFamily: sans, fontSize: 13, color: T.olive, marginTop: 12 }}>
            A voice sample is already saved. Re-recording replaces the clone sample. It does not replace a story in the archive.
          </p>
        )}

        {displayError && (
          <p style={{ color: T.error, fontSize: 13, marginTop: 12 }}>{displayError}</p>
        )}

        {blob && !recording && recordedSeconds < MIN_VOICE_SECONDS && (
          <p style={{ fontFamily: sans, fontSize: 13, color: T.error, marginTop: 12 }}>
            {UNDER_30S_MESSAGE}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            style={{
              border: `1px solid ${T.line}`,
              background: 'transparent',
              color: T.ink2,
              fontFamily: sans,
              fontWeight: 500,
              fontSize: 14,
              padding: '11px 20px',
              borderRadius: radius.control,
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
              background: T.sienna,
              color: T.onPrimary,
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 14,
              padding: '11px 22px',
              borderRadius: radius.control,
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
