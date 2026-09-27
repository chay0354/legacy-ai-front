import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { adminApi } from '../lib/adminApi'
import { T, radius, sans, serif } from '../design/tokens'
import {
  THEME_DEFAULTS, THEME_NUMBERS, contrastWarnings, mergeTheme, paintTheme, sanitizeTheme, themeDefaults,
  type ThemeDraft, type ThemeKey, type ThemeOverrides,
} from '../design/theme'
import { Body, Btn, Display, Eyebrow, Panel } from '../design/ui'

const COLORS: { key: ThemeKey; label: string }[] = [
  { key: 'paper', label: 'Paper' },
  { key: 'card', label: 'Card' },
  { key: 'ink', label: 'Text' },
  { key: 'ink2', label: 'Secondary text' },
  { key: 'status', label: 'Status text' },
  { key: 'walnut', label: 'Walnut' },
  { key: 'sienna', label: 'Primary action' },
  { key: 'olive', label: 'Olive' },
  { key: 'gold', label: 'Gold' },
  { key: 'onDark', label: 'Text on dark' },
  { key: 'onPrimary', label: 'Text on primary' },
  { key: 'error', label: 'Error' },
]

const NUMBERS: { key: keyof typeof THEME_NUMBERS; label: string; hint: string }[] = [
  { key: 'radiusControl', label: 'Control corners', hint: 'Buttons and fields' },
  { key: 'radiusCard', label: 'Card corners', hint: 'Panels and cards' },
  { key: 'gutterDesktop', label: 'Desktop margin', hint: 'Wide screens' },
  { key: 'gutterMobile', label: 'Phone margin', hint: 'Narrow screens' },
  { key: 'contentMax', label: 'Column width', hint: 'Main reading column' },
  { key: 'controlHeight', label: 'Control height', hint: 'Buttons and fields' },
]

const field: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: T.card,
  border: `1px solid ${T.line}`, borderRadius: radius.control, padding: '8px 10px',
  fontFamily: sans, fontSize: 14, color: T.ink,
}

export default function DesignDesk() {
  const [draft, setDraft] = useState<ThemeDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const published = useRef<ThemeOverrides>({})

  useEffect(() => {
    let live = true
    adminApi.theme()
      .then((data) => {
        if (!live) return
        published.current = sanitizeTheme(data.tokens)
        setDraft(mergeTheme(data.tokens))
      })
      .catch((e) => {
        if (!live) return
        setError(e instanceof Error ? e.message : 'Could not load the appearance')
        setDraft(themeDefaults())
      })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!draft) return
    paintTheme(draft)
  }, [draft])

  useEffect(() => () => {
    paintTheme(mergeTheme(published.current))
  }, [])

  function setColor(key: ThemeKey, value: string) {
    setDraft((prev) => prev ? { ...prev, [key]: value.toLowerCase() } : prev)
    setNote(null)
  }

  function setNumber(key: keyof typeof THEME_NUMBERS, value: string) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) return
    const { min, max } = THEME_NUMBERS[key]
    setDraft((prev) => prev ? { ...prev, [key]: Math.min(max, Math.max(min, n)) } : prev)
    setNote(null)
  }

  async function publish() {
    if (!draft) return
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const saved = await adminApi.setTheme(sanitizeTheme(draft))
      published.current = sanitizeTheme(saved.tokens)
      setDraft(mergeTheme(saved.tokens))
      setNote('Published. Every screen uses these settings.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish')
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const saved = await adminApi.setTheme({})
      published.current = {}
      setDraft(mergeTheme(saved.tokens))
      setNote('Restored the original appearance.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset')
    } finally {
      setBusy(false)
    }
  }

  if (!draft) return <Body>Loading appearance…</Body>

  const warnings = contrastWarnings(draft)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <Eyebrow>Appearance</Eyebrow>
        <Display size={34}>Shared look of the product</Display>
        <Body style={{ marginTop: 8, maxWidth: 640 }}>
          Colors, corners, margins, and column width are shared by the marketing site and the archive.
          This desk previews a draft immediately. Publish saves it for every visitor. Individual buttons stay where each screen places them.
        </Body>
      </div>

      <div className="design-desk-grid">
        <Panel>
          <Eyebrow>Color</Eyebrow>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 14 }}>
            {COLORS.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: sans, fontSize: 13, color: T.ink2 }}>
                {label}
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    aria-label={label}
                    value={String(draft[key])}
                    onChange={(e) => setColor(key, e.target.value)}
                    style={{ width: 42, height: 36, padding: 0, border: `1px solid ${T.line}`, background: 'transparent', borderRadius: radius.control }}
                  />
                  <input
                    key={String(draft[key])}
                    defaultValue={String(draft[key])}
                    spellCheck={false}
                    aria-label={`${label} hex`}
                    onBlur={(e) => {
                      const next = e.target.value.trim().toLowerCase()
                      if (/^#[0-9a-f]{6}$/.test(next)) setColor(key, next)
                      else e.target.value = String(draft[key])
                    }}
                    style={field}
                  />
                </span>
              </label>
            ))}
          </div>

          <div style={{ height: 22 }} />
          <Eyebrow>Shape and space</Eyebrow>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 14 }}>
            {NUMBERS.map(({ key, label, hint }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: sans, fontSize: 13, color: T.ink2 }}>
                {label}
                <input
                  type="number"
                  min={THEME_NUMBERS[key].min}
                  max={THEME_NUMBERS[key].max}
                  value={draft[key]}
                  onChange={(e) => setNumber(key, e.target.value)}
                  style={field}
                />
                <span style={{ fontSize: 12 }}>{hint} · {THEME_NUMBERS[key].min}–{THEME_NUMBERS[key].max}px · default {THEME_DEFAULTS[key]}</span>
              </label>
            ))}
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 16 }}>
          <div style={{ border: `1px solid ${T.cardEdge}`, borderRadius: radius.card, overflow: 'hidden' }}>
            <div style={{ background: T.walnut, color: T.onDark, padding: '16px 18px', fontFamily: serif, fontSize: 22 }}>
              Archive
              <div style={{ fontFamily: sans, fontSize: 13, marginTop: 4, color: T.onDark }}>A short line on the dark header</div>
            </div>
            <div style={{ background: T.paper, padding: 18 }}>
              <div style={{ fontFamily: serif, fontSize: 26, color: T.ink, lineHeight: 1.15 }}>A story worth keeping</div>
              <p style={{ fontFamily: sans, fontSize: 15, color: T.ink2, margin: '8px 0 0' }}>Secondary text sits on the paper.</p>
              <p style={{ fontFamily: sans, fontSize: 13, color: T.status, margin: '8px 0 12px' }}>Only you can access this archive.</p>
              <div style={{ background: T.card, border: `1px solid ${T.cardEdge}`, borderRadius: radius.card, padding: 12 }}>
                <div style={{ fontFamily: sans, fontSize: 14, color: T.ink }}>A card on the paper</div>
              </div>
              <button
                type="button"
                style={{
                  marginTop: 12, background: T.sienna, color: T.onPrimary, border: 'none',
                  borderRadius: radius.control, minHeight: 'var(--la-control)', padding: '0 18px',
                  fontFamily: sans, fontWeight: 600, fontSize: 14,
                }}
              >
                Begin
              </button>
            </div>
          </div>
          {warnings.map((line) => (
            <Body key={line} size={13.5} color={T.siennaDeep}>{line}</Body>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn disabled={busy} onClick={() => void publish()}>{busy ? 'Saving…' : 'Publish'}</Btn>
            <Btn tone="quiet" disabled={busy} onClick={() => void reset()}>Restore original</Btn>
          </div>
          {note && <Body size={13.5} color={T.olive}>{note}</Body>}
          {error && <Body size={13.5} color={T.error}>{error}</Body>}
        </div>
      </div>
    </div>
  )
}
