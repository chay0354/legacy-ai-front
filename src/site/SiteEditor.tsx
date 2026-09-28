import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminApi, adminToken } from '../lib/adminApi'
import { apiUrl } from '../lib/apiUrl'
import {
  applyTheme, contrastWarnings, mergeTheme, paintTheme, sanitizeTheme, THEME_DEFAULTS, THEME_NUMBERS,
  type ThemeDraft, type ThemeKey, type ThemeOverrides,
} from '../design/theme'
import {
  emptyContent, resetBlock, sanitizeContent, setBlockScale, setContentListener,
  setEditEnabled, setSelectionListener, watchContent, type ThemeContent,
} from '../design/themeContent'
import { T, radius, sans } from '../design/tokens'

const PAGES: [string, string][] = [
  ['/', 'Landing screen'],
  ['/how-it-works', 'Guide screen'],
  ['/the-archive', 'Archive page'],
  ['/pricing', 'Pricing screen'],
  ['/about', 'About screen'],
  ['/signin', 'Sign in screen'],
  ['/overview', 'Legacy screen'],
]

const LEGACY_PAGES: [string, string][] = [
  ['/overview', 'Overview'],
  ['/interview', 'Interview'],
  ['/edit', 'Edit'],
  ['/voice-and-photo', 'Voice'],
  ['/family-access', 'Family'],
  ['/ask', 'Ask'],
  ['/settings', 'Settings'],
  ['/billing', 'Billing'],
]

const LEGACY_PATHS = new Set(LEGACY_PAGES.map(([path]) => path))

const COLORS: { key: ThemeKey; label: string }[] = [
  { key: 'paper', label: 'Paper' },
  { key: 'card', label: 'Card' },
  { key: 'ink', label: 'Text' },
  { key: 'ink2', label: 'Secondary text' },
  { key: 'status', label: 'Status text' },
  { key: 'walnut', label: 'Walnut' },
  { key: 'sienna', label: 'Primary button' },
  { key: 'olive', label: 'Olive' },
  { key: 'gold', label: 'Gold' },
  { key: 'onDark', label: 'Text on dark' },
  { key: 'onPrimary', label: 'Text on button' },
  { key: 'error', label: 'Error' },
]

const NUMBERS: { key: keyof typeof THEME_NUMBERS; label: string }[] = [
  { key: 'radiusControl', label: 'Button corners' },
  { key: 'radiusCard', label: 'Card corners' },
  { key: 'gutterDesktop', label: 'Desktop margin' },
  { key: 'gutterMobile', label: 'Phone margin' },
  { key: 'contentMax', label: 'Column width' },
  { key: 'controlHeight', label: 'Button height' },
]

export default function SiteEditor() {
  const location = useLocation()
  const navigate = useNavigate()
  const staff = adminToken()
  const editing = new URLSearchParams(location.search).get('edit') === '1'
  const preview = location.search.includes('themePreview=1')
  const hidden = !staff || preview || location.pathname === '/admin'
  const [ready, setReady] = useState(false)
  const [content, setContent] = useState<ThemeContent>(emptyContent())
  const [selected, setSelected] = useState<{ key: string; scale: number; label: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [draft, setDraft] = useState<ThemeDraft | null>(null)
  const [styleOpen, setStyleOpen] = useState(false)
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
      setSelectionListener(null)
      setContentListener(null)
      return
    }
    setContentListener((next) => { setContent(next); setNote(null) })
    setSelectionListener((info) => setSelected(info))
    watchContent(contentRef.current, 'edit')
    return () => {
      setContentListener(null)
      setSelectionListener(null)
      watchContent(publishedContent.current, 'live')
      applyTheme(publishedColors.current)
      setEditEnabled(false)
    }
  }, [editing, ready, hidden])

  useEffect(() => {
    if (!editing || !draft) return
    paintTheme(draft)
  }, [editing, draft])

  if (hidden || !editing) return null

  function open(path: string) {
    navigate(`${path}?edit=1`)
  }

  async function publish() {
    setBusy(true)
    setNote(null)
    try {
      const saved = await adminApi.setTheme({
        ...sanitizeTheme(draft),
        ...(Object.keys(content.copy).length ? { copy: content.copy } : {}),
        ...(Object.keys(content.images).length ? { images: content.images } : {}),
        ...(Object.keys(content.blocks).length ? { blocks: content.blocks } : {}),
      })
      publishedColors.current = sanitizeTheme(saved.tokens)
      publishedContent.current = sanitizeContent(saved.tokens)
      setDraft(mergeTheme(saved.tokens))
      setContent(publishedContent.current)
      watchContent(publishedContent.current, 'edit')
      setNote('Published')
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not publish')
    } finally {
      setBusy(false)
    }
  }

  function setColor(key: ThemeKey, value: string) {
    const next = value.toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(next)) return
    setDraft((prev) => prev ? { ...prev, [key]: next } : prev)
    setNote(null)
  }

  function setNumber(key: keyof typeof THEME_NUMBERS, value: string) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n)) return
    const { min, max } = THEME_NUMBERS[key]
    setDraft((prev) => prev ? { ...prev, [key]: Math.min(max, Math.max(min, n)) } : prev)
    setNote(null)
  }

  async function restore() {
    setBusy(true)
    setNote(null)
    try {
      const saved = await adminApi.setTheme({})
      publishedColors.current = {}
      publishedContent.current = emptyContent()
      setDraft(mergeTheme(saved.tokens))
      setContent(emptyContent())
      watchContent(emptyContent(), 'edit')
      setNote('Restored the original appearance.')
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not restore')
    } finally {
      setBusy(false)
    }
  }

  const warnings = draft ? contrastWarnings(draft) : []

  return (
    <div data-la-editor="" style={bar}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {PAGES.map(([path, label]) => (
          <button
            key={path}
            type="button"
            onClick={() => open(path)}
            style={{
              ...quiet,
              background: (path === '/overview' ? LEGACY_PATHS.has(location.pathname) : location.pathname === path) ? T.sienna : 'transparent',
              color: (path === '/overview' ? LEGACY_PATHS.has(location.pathname) : location.pathname === path) ? T.onPrimary : T.ink,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {LEGACY_PATHS.has(location.pathname) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {LEGACY_PAGES.map(([path, label]) => (
            <button
              key={path}
              type="button"
              onClick={() => open(path)}
              style={{
                ...quiet,
                background: location.pathname === path ? T.walnut : 'transparent',
                color: location.pathname === path ? T.onDark : T.ink,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div style={{ fontFamily: sans, fontSize: 13, color: T.ink2, lineHeight: 1.4 }}>
        Click any wording to change it. Drag a heading, button, or section to move it.
        {LEGACY_PATHS.has(location.pathname) ? ' Legacy screen shows the same sample archive for every editor.' : ''}
        {selected ? ` Selected: ${selected.label}` : ''}
      </div>
      {selected && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: sans, fontSize: 13, color: T.ink }}>
          Size
          <input
            type="range"
            min={50}
            max={200}
            value={Math.round(selected.scale * 100)}
            onChange={(event) => {
              const scale = Number(event.target.value) / 100
              setBlockScale(selected.key, scale)
              setSelected({ ...selected, scale })
            }}
          />
          <button type="button" style={quiet} onClick={() => { resetBlock(selected.key); setSelected({ ...selected, scale: 1 }) }}>Reset</button>
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
        {note && <span style={{ fontFamily: sans, fontSize: 13, color: T.ink2 }}>{note}</span>}
        <button type="button" style={quiet} onClick={() => setStyleOpen((open) => !open)}>{styleOpen ? 'Hide style' : 'Style'}</button>
        <button type="button" style={quiet} disabled={busy} onClick={() => void restore()}>Restore</button>
        <button type="button" style={quiet} onClick={() => navigate('/admin')}>Close</button>
        <button type="button" style={primary} disabled={busy || !draft} onClick={() => void publish()}>{busy ? 'Saving…' : 'Publish'}</button>
      </div>
      {styleOpen && draft && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, width: '100%' }}>
          {COLORS.map(({ key, label }) => (
            <label key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 36px', gap: 8, alignItems: 'center', minWidth: 160, fontFamily: sans, fontSize: 13, color: T.ink }}>
              {label}
              <input
                type="color"
                aria-label={label}
                value={String(draft[key])}
                onChange={(event) => setColor(key, event.target.value)}
                style={{ width: 36, height: 28, padding: 0, border: `1px solid ${T.line}`, background: 'transparent', borderRadius: radius.control }}
              />
            </label>
          ))}
          {NUMBERS.map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160, fontFamily: sans, fontSize: 13, color: T.ink }}>
              {label}
              <input
                type="range"
                min={THEME_NUMBERS[key].min}
                max={THEME_NUMBERS[key].max}
                value={draft[key]}
                onChange={(event) => setNumber(key, event.target.value)}
              />
              <span style={{ fontSize: 12, color: T.ink2 }}>{draft[key]}px · default {THEME_DEFAULTS[key]}</span>
            </label>
          ))}
          {warnings.map((line) => (
            <span key={line} style={{ fontFamily: sans, fontSize: 13, color: T.siennaDeep }}>{line}</span>
          ))}
        </div>
      )}
    </div>
  )
}

const bar: CSSProperties = {
  position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 100001,
  display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
  background: T.card, color: T.ink, border: `1px solid ${T.line}`,
  borderRadius: radius.card, padding: '12px 14px',
  boxShadow: '0 16px 40px rgba(20,15,11,.22)',
}

const quiet: CSSProperties = {
  fontFamily: sans, fontSize: 13, color: T.ink, background: 'transparent',
  border: `1px solid ${T.line}`, borderRadius: radius.control, padding: '6px 10px', cursor: 'pointer',
}

const primary: CSSProperties = {
  fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.onPrimary, background: T.sienna,
  border: 'none', borderRadius: radius.control, padding: '8px 14px', cursor: 'pointer',
}
