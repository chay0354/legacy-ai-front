import { useEffect, useRef, useState } from 'react'
import { adminApi } from '../lib/adminApi'
import { T, radius, sans } from '../design/tokens'
import {
  THEME_DEFAULTS, THEME_NUMBERS, THEME_PREVIEW_READY, contrastWarnings, mergeTheme,
  postThemePreview, sanitizeTheme, themeDefaults,
  type ThemeDraft, type ThemeKey, type ThemeOverrides,
} from '../design/theme'
import { emptyContent, sanitizeContent, THEME_CONTENT_EDIT, type ThemeContent } from '../design/themeContent'
import { Body, Btn } from '../design/ui'

const SCREENS: { id: string; label: string; path: string; group: 'Site' | 'Archive' }[] = [
  { id: 'home', label: 'Home', path: '/', group: 'Site' },
  { id: 'how', label: 'How it works', path: '/how-it-works', group: 'Site' },
  { id: 'archive-page', label: 'The Archive', path: '/the-archive', group: 'Site' },
  { id: 'pricing', label: 'Pricing', path: '/pricing', group: 'Site' },
  { id: 'about', label: 'About', path: '/about', group: 'Site' },
  { id: 'signin', label: 'Sign in', path: '/signin', group: 'Site' },
  { id: 'overview', label: 'Overview', path: '/overview', group: 'Archive' },
  { id: 'edit', label: 'Edit archive', path: '/edit', group: 'Archive' },
  { id: 'voice', label: 'Voice & photograph', path: '/voice-and-photo', group: 'Archive' },
  { id: 'family', label: 'Family access', path: '/family-access', group: 'Archive' },
  { id: 'ask', label: 'Ask', path: '/ask', group: 'Archive' },
  { id: 'settings', label: 'Settings', path: '/settings', group: 'Archive' },
  { id: 'billing', label: 'Billing', path: '/billing', group: 'Archive' },
  { id: 'interview', label: 'Interview', path: '/interview', group: 'Archive' },
]

const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: '100%' },
  { id: 'tablet', label: 'Tablet', width: '834px' },
  { id: 'phone', label: 'Phone', width: '390px' },
] as const

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

function previewSrc(path: string) {
  const url = new URL(path, location.origin)
  url.searchParams.set('themePreview', '1')
  return url.pathname + url.search
}

export default function DesignDesk() {
  const [draft, setDraft] = useState<ThemeDraft | null>(null)
  const [content, setContent] = useState<ThemeContent>(emptyContent())
  const [screenId, setScreenId] = useState('home')
  const [device, setDevice] = useState<(typeof DEVICES)[number]['id']>('desktop')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const published = useRef<ThemeOverrides>({})
  const screen = SCREENS.find((item) => item.id === screenId) ?? SCREENS[0]
  const width = DEVICES.find((item) => item.id === device)?.width ?? '100%'

  useEffect(() => {
    let live = true
    adminApi.theme()
      .then((data) => {
        if (!live) return
        published.current = sanitizeTheme(data.tokens)
        setContent(sanitizeContent(data.tokens))
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
    const frame = frameRef.current
    const send = () => postThemePreview(frame, draft, content)
    send()
    const onReady = (event: MessageEvent) => {
      if (event.origin !== location.origin) return
      if (event.source !== frame?.contentWindow) return
      if (event.data?.type !== THEME_PREVIEW_READY) return
      send()
    }
    window.addEventListener('message', onReady)
    return () => window.removeEventListener('message', onReady)
  }, [draft, content, screenId])

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

  useEffect(() => {
    const onEdit = (event: MessageEvent) => {
      if (event.origin !== location.origin) return
      if (event.source !== frameRef.current?.contentWindow) return
      if (event.data?.type !== THEME_CONTENT_EDIT) return
      setContent(sanitizeContent(event.data.content))
      setNote(null)
    }
    window.addEventListener('message', onEdit)
    return () => window.removeEventListener('message', onEdit)
  }, [])

  function savedTokens(colors: ThemeOverrides, next: ThemeContent) {
    return {
      ...colors,
      ...(Object.keys(next.copy).length ? { copy: next.copy } : {}),
      ...(Object.keys(next.images).length ? { images: next.images } : {}),
    }
  }

  async function publish() {
    if (!draft) return
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const saved = await adminApi.setTheme(savedTokens(sanitizeTheme(draft), content))
      published.current = sanitizeTheme(saved.tokens)
      setContent(sanitizeContent(saved.tokens))
      setDraft(mergeTheme(saved.tokens))
      setNote('Published. Every visitor sees this.')
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
      setContent(emptyContent())
      setDraft(mergeTheme(saved.tokens))
      setNote('Restored the original appearance.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset')
    } finally {
      setBusy(false)
    }
  }

  const warnings = draft ? contrastWarnings(draft) : []

  return (
    <div className="theme-customizer">
      <aside className="theme-customizer-side">
        <div style={{ padding: '16px 14px 8px' }}>
          <div style={{ fontFamily: sans, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: T.ink2 }}>
            Screens
          </div>
          <p style={{ fontFamily: sans, fontSize: 13, color: T.ink2, margin: '8px 0 0', lineHeight: 1.45 }}>
            Click wording to change it. Click a photo, drag to move it, and use the size slider. Nothing is public until you publish.
          </p>
        </div>
        {(['Site', 'Archive'] as const).map((group) => (
          <div key={group} style={{ padding: '4px 10px 8px' }}>
            <div style={{ fontFamily: sans, fontSize: 12, color: T.status, padding: '8px 6px 4px' }}>{group}</div>
            {SCREENS.filter((item) => item.group === group).map((item) => {
              const on = item.id === screen.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setScreenId(item.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    fontFamily: sans, fontSize: 14, color: on ? T.onPrimary : T.ink,
                    background: on ? T.sienna : 'transparent', border: 'none',
                    borderRadius: radius.control, padding: '8px 10px',
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
        <p style={{ fontFamily: sans, fontSize: 12.5, color: T.ink2, margin: '0 14px 8px', lineHeight: 1.45 }}>
          Archive screens open the account already signed in on this browser.
        </p>

        <div style={{ padding: '8px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: sans, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: T.ink2 }}>
            Style
          </div>
          {draft && COLORS.map(({ key, label }) => (
            <label key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 36px', gap: 8, alignItems: 'center', fontFamily: sans, fontSize: 13, color: T.ink }}>
              {label}
              <input
                type="color"
                aria-label={label}
                value={String(draft[key])}
                onChange={(e) => setColor(key, e.target.value)}
                style={{ width: 36, height: 28, padding: 0, border: `1px solid ${T.line}`, background: 'transparent', borderRadius: radius.control }}
              />
            </label>
          ))}
          {draft && NUMBERS.map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: sans, fontSize: 13, color: T.ink }}>
              {label}
              <input
                type="range"
                min={THEME_NUMBERS[key].min}
                max={THEME_NUMBERS[key].max}
                value={draft[key]}
                onChange={(e) => setNumber(key, e.target.value)}
              />
              <span style={{ fontSize: 12, color: T.ink2 }}>{draft[key]}px · default {THEME_DEFAULTS[key]}</span>
            </label>
          ))}
          {warnings.map((line) => (
            <Body key={line} size={13} color={T.siennaDeep}>{line}</Body>
          ))}
        </div>

        <div style={{ position: 'sticky', bottom: 0, padding: 12, background: T.paper, borderTop: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn disabled={busy || !draft} onClick={() => void publish()}>{busy ? 'Saving…' : 'Publish'}</Btn>
            <Btn tone="quiet" disabled={busy || !draft} onClick={() => void reset()}>Restore</Btn>
          </div>
          {note && <Body size={13} color={T.olive}>{note}</Body>}
          {error && <Body size={13} color={T.error}>{error}</Body>}
        </div>
      </aside>

      <section style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          background: T.walnut, color: T.onDark, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: sans, fontSize: 14 }}>{screen.label}</span>
          <span style={{ fontFamily: sans, fontSize: 13, color: T.onDark2 }}>Click text. Drag a photo.</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {DEVICES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={device === item.id}
                onClick={() => setDevice(item.id)}
                style={{
                  fontFamily: sans, fontSize: 13, cursor: 'pointer',
                  borderRadius: radius.control, padding: '6px 10px',
                  background: device === item.id ? T.onDark : 'transparent',
                  color: device === item.id ? T.walnut : T.onDark,
                  border: `1px solid ${T.darkLine}`,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="theme-customizer-canvas">
          <iframe
            ref={frameRef}
            key={screen.id}
            title={screen.label}
            src={previewSrc(screen.path)}
            className="theme-customizer-frame"
            style={{ width, maxWidth: '100%' }}
            onLoad={() => { if (draft) postThemePreview(frameRef.current, draft, content) }}
          />
        </div>
      </section>
    </div>
  )
}
