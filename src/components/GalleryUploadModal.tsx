import { useEffect, useId, useRef, useState } from 'react'
import { T, radius, sans, serif, shadow } from '../design/tokens'
import { useDialogA11y } from '../lib/useDialogA11y'

const field = {
  display: 'block' as const,
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: radius.control,
  border: `1px solid ${T.line}`,
  background: T.card,
  fontFamily: sans,
  fontSize: 15,
  color: T.ink,
  boxSizing: 'border-box' as const,
}

type Props = {
  open: boolean
  saving?: boolean
  error?: string | null
  onSave: (file: File, caption: string, title: string) => void
  onClose: () => void
}

export default function GalleryUploadModal({
  open,
  saving = false,
  error,
  onSave,
  onClose,
}: Props) {
  const titleId = useId()
  const panelRef = useDialogA11y(open, onClose)
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!open) return
    setFile(null)
    setPreview(null)
    setCaption('')
    setTitle('')
  }, [open])

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!open) return null

  const canSave = Boolean(file) && caption.trim().length > 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
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
        <h2 id={titleId} style={{ fontFamily: serif, fontSize: 24, fontWeight: 400, color: T.ink, margin: 0 }}>Add photos</h2>
        <p style={{ fontFamily: sans, fontSize: 14, color: T.ink2, margin: '8px 0 18px', lineHeight: 1.5 }}>
          Upload a photo and write what it means — faces, places, letters, anything worth keeping.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%',
            minHeight: preview ? 'auto' : 160,
            border: `1px dashed ${T.line}`,
            borderRadius: radius.control,
            background: T.paper,
            cursor: 'pointer',
            padding: preview ? 0 : 16,
            overflow: 'hidden',
          }}
        >
          {preview ? (
            <img src={preview} alt="Preview" style={{ display: 'block', width: '100%', maxHeight: 280, objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: sans, fontSize: 14, color: T.ink2 }}>Click to choose a photo</span>
          )}
        </button>

        <label style={{ display: 'block', marginTop: 14 }}>
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.ink2 }}>Title (optional)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dad at the lake house"
            style={field}
          />
        </label>

        <label style={{ display: 'block', marginTop: 14 }}>
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.ink2 }}>What is this photo about?</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            placeholder="Who is in the photo? Where was it taken? Why does it matter to your family?"
            style={{ ...field, resize: 'vertical' }}
          />
        </label>

        {error && (
          <p style={{ fontFamily: sans, fontSize: 13, color: '#b04a3a', margin: '14px 0 0' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => file && onSave(file, caption.trim(), title.trim())}
            style={{
              cursor: canSave && !saving ? 'pointer' : 'not-allowed',
              border: 'none',
              background: T.sienna,
              color: T.onPrimary,
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 14,
              padding: '12px 20px',
              borderRadius: radius.control,
              opacity: canSave && !saving ? 1 : 0.55,
            }}
          >
            {saving ? 'Uploading…' : 'Add to gallery'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            style={{
              cursor: 'pointer',
              border: `1px solid ${T.line}`,
              background: 'transparent',
              color: T.ink2,
              fontFamily: sans,
              fontWeight: 500,
              fontSize: 14,
              padding: '12px 18px',
              borderRadius: radius.control,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
