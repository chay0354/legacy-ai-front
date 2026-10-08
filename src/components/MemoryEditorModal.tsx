import { useEffect, useId, useState } from 'react'
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

export type MemoryFormValues = {
  title: string
  summary: string
  year: string
  category: string
}

type Props = {
  open: boolean
  mode: 'add' | 'edit'
  initial?: Partial<MemoryFormValues>
  saving?: boolean
  error?: string | null
  onSave: (values: MemoryFormValues) => void
  onDelete?: () => void
  onClose: () => void
}

const CATEGORIES = ['story', 'family', 'work', 'place', 'lesson', 'other']

export default function MemoryEditorModal({
  open,
  mode,
  initial,
  saving = false,
  error,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const titleId = useId()
  const panelRef = useDialogA11y(open, onClose)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [year, setYear] = useState('')
  const [category, setCategory] = useState('story')

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title || '')
    setSummary(initial?.summary || '')
    setYear(initial?.year || '')
    setCategory(initial?.category || 'story')
  }, [open, initial?.title, initial?.summary, initial?.year, initial?.category])

  if (!open) return null

  const canSave = title.trim().length > 0 && summary.trim().length > 0

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
          maxWidth: 520,
          background: T.card,
          border: `1px solid ${T.line}`,
          borderRadius: radius.card,
          padding: '24px 26px',
          boxShadow: shadow.lift,
          outline: 'none',
        }}
      >
        <h2 id={titleId} style={{ fontFamily: serif, fontSize: 24, fontWeight: 400, color: T.ink, margin: 0 }}>
          {mode === 'add' ? 'Add an entry' : 'Edit entry'}
        </h2>
        <p style={{ fontFamily: sans, fontSize: 14, color: T.ink2, margin: '8px 0 18px', lineHeight: 1.5 }}>
          Write a story in your own words, and keep it in your archive.
        </p>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.ink2 }}>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Summer at the lake"
            style={field}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.ink2 }}>Story</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={5}
            placeholder="What happened? Who was there? Why does it matter?"
            style={{ ...field, resize: 'vertical' }}
          />
        </label>

        <div className="legacy-modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <label>
            <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.ink2 }}>Year (optional)</span>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 1974"
              style={field}
            />
          </label>
          <label>
            <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.ink2 }}>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={field}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p style={{ fontFamily: sans, fontSize: 13, color: T.error, margin: '0 0 14px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => onSave({ title: title.trim(), summary: summary.trim(), year: year.trim(), category })}
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
            {saving ? 'Saving…' : mode === 'add' ? 'Add entry' : 'Save changes'}
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
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              disabled={saving}
              onClick={onDelete}
              style={{
                marginLeft: 'auto',
                cursor: 'pointer',
                border: `1px solid ${T.error}`,
                background: 'transparent',
                color: T.error,
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 13,
                padding: '11px 16px',
                borderRadius: radius.control,
              }}
            >
              Delete memory
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
