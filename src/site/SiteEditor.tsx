import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminApi, adminToken } from '../lib/adminApi'
import { apiUrl } from '../lib/apiUrl'
import {
  applyTheme, mergeTheme, paintTheme, sanitizeTheme, THEME_NUMBERS,
  type ThemeDraft, type ThemeKey, type ThemeOverrides,
} from '../design/theme'
import {
  closePanel, emptyContent, sanitizeContent, setContentListener, setEditEnabled, watchContent, type ThemeContent,
} from '../design/themeContent'
import { T, radius, sans } from '../design/tokens'

const SITE_SCREENS: [string, string][] = [
  ['/', 'Landing'],
  ['/how-it-works', 'How it works'],
  ['/the-archive', 'The archive'],
  ['/pricing', 'Pricing'],
  ['/about', 'About'],
  ['/signin', 'Sign in'],
]

const LEGACY_SCREENS: [string, string][] = [
  ['/overview', 'Overview'],
  ['/interview', 'Interview'],
  ['/edit', 'Edit entries'],
  ['/voice-and-photo', 'Voice & photo'],
  ['/family-access', 'Family access'],
  ['/ask', 'Ask the archive'],
  ['/settings', 'Settings'],
  ['/billing', 'Billing'],
]

const SITE_COLORS: { key: ThemeKey; label: string }[] = [
  { key: 'paper', label: 'Page' },
  { key: 'card', label: 'Cards' },
  { key: 'ink', label: 'Text' },
  { key: 'sienna', label: 'Buttons' },
  { key: 'walnut', label: 'Dark areas' },
]

function packTokens(draft: ThemeDraft | null, content: ThemeContent) {
  return {
    ...sanitizeTheme(draft),
    ...(Object.keys(content.copy).length ? { copy: content.copy } : {}),
    ...(Object.keys(content.images).length ? { images: content.images } : {}),
    ...(Object.keys(content.blocks).length ? { blocks: content.blocks } : {}),
    ...(Object.keys(content.styles).length ? { styles: content.styles } : {}),
  }
}

export default function SiteEditor() {
  const location = useLocation()
  const navigate = useNavigate()
  const staff = adminToken()
  const editing = new URLSearchParams(location.search).get('edit') === '1'
  const preview = location.search.includes('themePreview=1')
  const hidden = !staff || preview || location.pathname === '/admin'
  const [ready, setReady] = useState(false)
  const [content, setContent] = useState<ThemeContent>(emptyContent())
  const [draft, setDraft] = useState<ThemeDraft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [colorsOpen, setColorsOpen] = useState(false)
  const publishedColors = useRef<ThemeOverrides>({})
  const publishedContent = useRef<ThemeContent>(emptyContent())

  useEffect(() => {
    if (hidden) return
    let live = true
    fetch(apiUrl('/api/theme'))
      .then((res) => res.json())
      .then((data: { tokens?: unknown }) => {
        if (!live) return
        publishedColors.current = sanitizeTheme(data.tokens)
        publishedContent.current = sanitizeContent(data.tokens)
        setDraft(mergeTheme(data.tokens))
        setContent(publishedContent.current)
        setReady(true)
      })
      .catch(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [hidden])

  const contentRef = useRef(content)
  contentRef.current = content

  useEffect(() => {
    if (hidden) return
    if (!editing || !ready) {
      setEditEnabled(false)
      setContentListener(null)
      return
    }
    setContentListener((next) => { setContent(next); setDirty(true); setNote(null) })
    watchContent(contentRef.current, 'edit')
    return () => {
      setContentListener(null)
      watchContent(publishedContent.current, 'live')
      applyTheme(publishedColors.current)
      setEditEnabled(false)
    }
  }, [editing, ready, hidden])

  useEffect(() => {
    if (!editing || !draft) return
    paintTheme(draft)
  }, [editing, draft])

  useEffect(() => {
    if (!colorsOpen) return
    const away = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest?.('[data-la-editor]')) setColorsOpen(false)
    }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [colorsOpen])

  if (hidden || !editing) return null

  async function publish() {
    setBusy(true)
    setNote(null)
    try {
      const saved = await adminApi.setTheme(packTokens(draft, content))
      publishedColors.current = sanitizeTheme(saved.tokens)
      publishedContent.current = sanitizeContent(saved.tokens)
      setDraft(mergeTheme(saved.tokens))
      setContent(publishedContent.current)
      watchContent(publishedContent.current, 'edit')
      setDirty(false)
      setNote('Published. Visitors see it now.')
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not publish')
    } finally {
      setBusy(false)
    }
  }

  function close() {
    if (dirty && !window.confirm('Leave without publishing? Your changes will be lost.')) return
    navigate('/admin')
  }

  function setColor(key: ThemeKey, value: string) {
    const next = value.toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(next)) return
    setDraft((prev) => prev ? { ...prev, [key]: next } : prev)
    setDirty(true)
    setNote(null)
  }

  function setCorners(value: string) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) return
    const { min, max } = THEME_NUMBERS.radiusControl
    const card = THEME_NUMBERS.radiusCard
    setDraft((prev) => prev ? ({
      ...prev,
      radiusControl: Math.min(max, Math.max(min, n)),
      radiusCard: Math.min(card.max, Math.max(card.min, n * 2)),
    } as ThemeDraft) : prev)
    setDirty(true)
  }

  async function startOver() {
    if (!window.confirm('Put the whole site back to its original look and wording? This is published right away.')) return
    setBusy(true)
    setNote(null)
    try {
      const saved = await adminApi.setTheme({})
      publishedColors.current = {}
      publishedContent.current = emptyContent()
      setDraft(mergeTheme(saved.tokens))
      setContent(emptyContent())
      watchContent(emptyContent(), 'edit')
      setDirty(false)
      setNote('Back to the original.')
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not restore')
    } finally {
      setBusy(false)
    }
  }

  const legacy = LEGACY_SCREENS.some(([path]) => path === location.pathname)
  const current = [...SITE_SCREENS, ...LEGACY_SCREENS].some(([path]) => path === location.pathname)
    ? location.pathname
    : ''

  return (
    <div data-la-editor="" style={bar}>
      {colorsOpen && draft && (
        <div style={colorsPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontFamily: sans, fontSize: 14, color: T.ink }}>Site colors</strong>
            <button type="button" aria-label="Close" style={iconBtn} onClick={() => setColorsOpen(false)}>×</button>
          </div>
          <span style={{ fontFamily: sans, fontSize: 12.5, color: T.ink2 }}>
            These change every screen. To color one thing, click it on the page.
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {SITE_COLORS.map(({ key, label }) => (
              <label key={key} style={swatchRow}>
                <input
                  type="color"
                  value={String(draft[key])}
                  onChange={(event) => setColor(key, event.target.value)}
                  style={swatchInput}
                />
                {label}
              </label>
            ))}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: sans, fontSize: 13, color: T.ink }}>
            Rounded corners
            <input
              type="range"
              min={THEME_NUMBERS.radiusControl.min}
              max={THEME_NUMBERS.radiusControl.max}
              value={draft.radiusControl}
              onChange={(event) => setCorners(event.target.value)}
            />
          </label>
          <button type="button" style={{ ...quiet, alignSelf: 'flex-start', color: T.error }} disabled={busy} onClick={() => void startOver()}>
            Start over with the original site
          </button>
        </div>
      )}

      <select
        aria-label="Screen"
        value={current}
        onChange={(event) => navigate(`${event.target.value}?edit=1`)}
        style={picker}
      >
        {!current && <option value="">This screen</option>}
        <optgroup label="Website">
          {SITE_SCREENS.map(([path, label]) => <option key={path} value={path}>{label}</option>)}
        </optgroup>
        <optgroup label="Legacy (sample archive)">
          {LEGACY_SCREENS.map(([path, label]) => <option key={path} value={path}>{label}</option>)}
        </optgroup>
      </select>

      <span style={hint}>
        {note ?? (legacy ? 'Sample archive. Click anything to edit it.' : 'Click anything to edit it. Drag to move.')}
      </span>

      <button type="button" style={quiet} onClick={() => { closePanel(); setColorsOpen((open) => !open) }}>Site colors</button>
      <button type="button" style={quiet} onClick={close}>Close</button>
      <button
        type="button"
        style={{ ...primary, opacity: dirty ? 1 : 0.55 }}
        disabled={busy || !draft || !dirty}
        onClick={() => void publish()}
      >
        {busy ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  )
}

const bar: CSSProperties = {
  position: 'fixed', left: '50%', bottom: 14, transform: 'translateX(-50%)', zIndex: 100001,
  width: 'min(920px, calc(100vw - 24px))', boxSizing: 'border-box',
  display: 'flex', gap: 8, alignItems: 'center',
  background: T.card, color: T.ink, border: `1px solid ${T.line}`,
  borderRadius: radius.card, padding: '10px 12px',
  boxShadow: '0 16px 40px rgba(20,15,11,.22)',
}

const colorsPanel: CSSProperties = {
  position: 'absolute', right: 0, bottom: 'calc(100% + 10px)', width: 300,
  display: 'flex', flexDirection: 'column', gap: 12,
  background: T.card, border: `1px solid ${T.line}`, borderRadius: radius.card,
  padding: 14, boxShadow: '0 16px 40px rgba(20,15,11,.22)',
}

const hint: CSSProperties = {
  fontFamily: sans, fontSize: 13, color: T.ink2, flex: '1 1 0', minWidth: 0,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

const picker: CSSProperties = {
  fontFamily: sans, fontSize: 14, color: T.ink, background: T.paper,
  border: `1px solid ${T.line}`, borderRadius: radius.control, padding: '7px 10px', cursor: 'pointer',
}

const quiet: CSSProperties = {
  fontFamily: sans, fontSize: 13.5, color: T.ink, background: 'transparent',
  border: `1px solid ${T.line}`, borderRadius: radius.control, padding: '7px 12px', cursor: 'pointer',
}

const primary: CSSProperties = {
  fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.onPrimary, background: T.sienna,
  border: 'none', borderRadius: radius.control, padding: '8px 16px', cursor: 'pointer',
}

const iconBtn: CSSProperties = {
  border: 'none', background: 'transparent', fontSize: 20, lineHeight: 1, color: T.ink2, cursor: 'pointer',
}

const swatchRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontFamily: sans, fontSize: 13, color: T.ink, cursor: 'pointer',
}

const swatchInput: CSSProperties = {
  width: 30, height: 30, padding: 0, border: `1px solid ${T.line}`, borderRadius: radius.control,
  background: 'transparent', cursor: 'pointer',
}
