import { useEffect, useState } from 'react'

const C = {
  card: '#fbf6ec',
  ink: '#2b241c',
  ink2: '#6e6253',
  ink3: '#9a8d79',
  line: '#ddccb0',
  terra: '#c06a44',
}
const serif = "'Newsreader', Georgia, serif"
const sans = "'Hanken Grotesk', system-ui, sans-serif"

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
        className="legacy-modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: '24px 26px',
          boxShadow: '0 24px 48px rgba(43,36,28,.18)',
        }}
      >
        <div style={{ fontFamily: serif, fontSize: 24, color: C.ink }}>
          {mode === 'add' ? 'Add a memory' : 'Edit memory'}
        </div>
        <p style={{ fontFamily: sans, fontSize: 13, color: C.ink2, margin: '8px 0 18px', lineHeight: 1.5 }}>
          Write a story in your own words. It stays on your legacy home — no need to restart the interview.
        </p>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.ink2 }}>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Summer at the lake"
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${C.line}`,
              background: '#fff',
              fontFamily: sans,
              fontSize: 14,
              color: C.ink,
              boxSizing: 'border-box',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.ink2 }}>Story</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={5}
            placeholder="What happened? Who was there? Why does it matter?"
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${C.line}`,
              background: '#fff',
              fontFamily: sans,
              fontSize: 14,
              color: C.ink,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </label>

        <div className="legacy-modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <label>
            <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.ink2 }}>Year (optional)</span>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 1974"
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${C.line}`,
                background: '#fff',
                fontFamily: sans,
                fontSize: 14,
                color: C.ink,
                boxSizing: 'border-box',
              }}
            />
          </label>
          <label>
            <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.ink2 }}>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${C.line}`,
                background: '#fff',
                fontFamily: sans,
                fontSize: 14,
                color: C.ink,
                boxSizing: 'border-box',
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p style={{ fontFamily: sans, fontSize: 13, color: '#b04a3a', margin: '0 0 14px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => onSave({ title: title.trim(), summary: summary.trim(), year: year.trim(), category })}
            style={{
              cursor: canSave && !saving ? 'pointer' : 'not-allowed',
              border: 'none',
              background: C.terra,
              color: '#fbf6ec',
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 14,
              padding: '12px 20px',
              borderRadius: 999,
              opacity: canSave && !saving ? 1 : 0.55,
            }}
          >
            {saving ? 'Saving…' : mode === 'add' ? 'Add memory' : 'Save changes'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            style={{
              cursor: 'pointer',
              border: `1px solid ${C.line}`,
              background: 'transparent',
              color: C.ink2,
              fontFamily: sans,
              fontWeight: 500,
              fontSize: 14,
              padding: '12px 18px',
              borderRadius: 999,
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
                border: '1px solid #e8b4ab',
                background: 'transparent',
                color: '#b04a3a',
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 13,
                padding: '11px 16px',
                borderRadius: 999,
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
