import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminApi, adminToken } from '../lib/adminApi'
import { apiUrl } from '../lib/apiUrl'
import { sanitizeTheme, type ThemeOverrides } from '../design/theme'
import {
  emptyContent, resetBlock, sanitizeContent, setBlockScale, setContentListener,
  setEditEnabled, setSelectionListener, watchContent, type ThemeContent,
} from '../design/themeContent'
import { T, radius, sans } from '../design/tokens'

const PAGES: [string, string][] = [
  ['/', 'Home'],
  ['/how-it-works', 'How it works'],
  ['/the-archive', 'The Archive'],
  ['/pricing', 'Pricing'],
  ['/about', 'About'],
  ['/signin', 'Sign in'],
  ['/overview', 'Overview'],
  ['/interview', 'Interview'],
  ['/settings', 'Settings'],
  ['/billing', 'Billing'],
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
  const colors = useRef<ThemeOverrides>({})

  useEffect(() => {
    if (!staff) return
    let live = true
    fetch(apiUrl('/api/theme'))
      .then((res) => res.json())
      .then((data: { tokens?: unknown }) => {
        if (!live) return
        colors.current = sanitizeTheme(data.tokens)
        setContent(sanitizeContent(data.tokens))
        setReady(true)
      })
      .catch(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [staff])

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
    }
  }, [editing, ready, hidden])

  if (hidden) return null

  function open(path: string) {
    navigate(`${path}?edit=1`)
  }

  async function publish() {
    setBusy(true)
    setNote(null)
    try {
      const saved = await adminApi.setTheme({
        ...colors.current,
        ...(Object.keys(content.copy).length ? { copy: content.copy } : {}),
        ...(Object.keys(content.images).length ? { images: content.images } : {}),
        ...(Object.keys(content.blocks).length ? { blocks: content.blocks } : {}),
      })
      colors.current = sanitizeTheme(saved.tokens)
      setContent(sanitizeContent(saved.tokens))
      watchContent(sanitizeContent(saved.tokens), 'edit')
      setNote('Published')
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not publish')
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        data-la-editor=""
        onClick={() => open(location.pathname)}
        style={chip}
      >
        Edit this page
      </button>
    )
  }

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
              background: location.pathname === path ? T.sienna : 'transparent',
              color: location.pathname === path ? T.onPrimary : T.ink,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ fontFamily: sans, fontSize: 13, color: T.ink2, lineHeight: 1.4 }}>
        Click any wording to change it. Drag a heading, button, or section to move it.
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
        <button type="button" style={quiet} onClick={() => navigate(location.pathname)}>Close</button>
        <button type="button" style={primary} disabled={busy} onClick={() => void publish()}>{busy ? 'Saving…' : 'Publish'}</button>
      </div>
    </div>
  )
}

const chip: CSSProperties = {
  position: 'fixed', right: 16, bottom: 16, zIndex: 100001,
  background: T.walnut, color: T.onDark, border: 'none', borderRadius: radius.control,
  padding: '10px 14px', fontFamily: sans, fontSize: 14, cursor: 'pointer',
  boxShadow: '0 10px 28px rgba(20,15,11,.28)',
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
