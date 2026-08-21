import type { CSSProperties, ReactNode } from 'react'
import { T, radius, sans, serif, shadow } from './tokens'

/* ─────────────────────────────── icons ─────────────────────────────── */
/** Thin, minimal, useful line icons. No sparkles, robots, hearts, trophies. */
export type IconName =
  | 'overview' | 'interview' | 'story' | 'voice' | 'photo' | 'people'
  | 'lock' | 'settings' | 'pen' | 'check' | 'clock' | 'folder'
  | 'play' | 'plus' | 'arrow' | 'ask' | 'document' | 'live'

const PATHS: Record<IconName, ReactNode> = {
  overview: <><path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M8 17v-5h4v5" /></>,
  interview: <><path d="M4 4.5h12v8.5H8.5L5 16v-3H4z" /><path d="M7.5 8h5M7.5 10.5h3" /></>,
  story: <><path d="M4 4h5.5a1.5 1.5 0 0 1 1.5 1.5V16H5.5A1.5 1.5 0 0 1 4 14.5z" /><path d="M16 4h-5.5A1.5 1.5 0 0 0 9 5.5V16h5.5A1.5 1.5 0 0 0 16 14.5z" /></>,
  voice: <><rect x="8" y="3" width="4" height="8" rx="2" /><path d="M5.5 9.5a4.5 4.5 0 0 0 9 0M10 14v3M7.5 17h5" /></>,
  photo: <><rect x="3" y="4.5" width="14" height="11" rx="1.5" /><path d="M3 12.5l3.5-3 3 2.5 3-3.5L17 12" /><circle cx="7" cy="8" r="1" /></>,
  people: <><circle cx="7.5" cy="7" r="2.5" /><path d="M3 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" /><path d="M13 5.2a2.5 2.5 0 0 1 0 4.6M14.5 15.6c0-1.6-.5-2.9-1.5-3.8 2.2-.2 4 1.2 4 3.8" /></>,
  lock: <><rect x="4.5" y="9" width="11" height="7.5" rx="1.5" /><path d="M7.2 9V6.8a2.8 2.8 0 0 1 5.6 0V9" /></>,
  settings: <><circle cx="10" cy="10" r="2.4" /><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.1 5.1l1.4 1.4M13.5 13.5l1.4 1.4M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4" /></>,
  pen: <><path d="M4 16l1-3.5L13 4.5 15.5 7l-8 8z" /><path d="M11.5 6.5 13.5 8.5" /></>,
  check: <path d="M4.5 10.5 8 14l7.5-8" />,
  clock: <><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5V10l2.5 1.8" /></>,
  folder: <><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.5 2h6A1.5 1.5 0 0 1 17 8.5v6A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5z" /></>,
  play: <path d="M7.5 5.5 14.5 10l-7 4.5z" />,
  plus: <path d="M10 4.5v11M4.5 10h11" />,
  arrow: <><path d="M4 10h11" /><path d="M11 6.5 15 10l-4 3.5" /></>,
  ask: <><path d="M4 5.5h12v7H9l-3.5 3v-3H4z" /><path d="M8.6 8.2a1.5 1.5 0 1 1 1.8 1.5v.8" /><path d="M10.4 11.9v.1" /></>,
  document: <><path d="M5.5 3.5h6L15 7v9.5H5.5z" /><path d="M11.2 3.6V7H15M8 10.5h4M8 13h4" /></>,
  live: <><rect x="3.5" y="3.5" width="13" height="13" rx="1.5" /><circle cx="10" cy="8.2" r="2.2" /><path d="M6.2 16c.4-2.4 1.8-3.8 3.8-3.8s3.4 1.4 3.8 3.8" /></>,
}

export function Icon({
  name, size = 20, color = 'currentColor', strokeWidth = 1.25, style,
}: { name: IconName; size?: number; color?: string; strokeWidth?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flex: '0 0 auto', display: 'block', ...style }}
    >
      {PATHS[name]}
    </svg>
  )
}

/* ───────────────────────────── typography ──────────────────────────── */
export function Eyebrow({
  children, color = T.ink3, style,
}: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <span style={{
      fontFamily: sans, fontSize: 11, fontWeight: 500, letterSpacing: '.16em',
      textTransform: 'uppercase', color, ...style,
    }}>{children}</span>
  )
}

export function Display({
  children, size = 34, italic, color = T.ink, weight = 400, style,
}: {
  children: ReactNode; size?: number; italic?: boolean; color?: string
  weight?: number; style?: CSSProperties
}) {
  return (
    <h2 style={{
      fontFamily: serif, fontSize: size, fontWeight: weight, lineHeight: 1.12,
      letterSpacing: '-.012em', color, margin: 0,
      fontStyle: italic ? 'italic' : 'normal', textWrap: 'pretty',
      ...style,
    }}>{children}</h2>
  )
}

export function Body({
  children, size = 15, color = T.ink2, style,
}: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <p style={{
      fontFamily: sans, fontSize: size, lineHeight: 1.62, color, margin: 0,
      textWrap: 'pretty', ...style,
    }}>{children}</p>
  )
}

export function UiLabel({
  children, color = T.ink, weight = 600, size = 14, style,
}: { children: ReactNode; color?: string; weight?: number; size?: number; style?: CSSProperties }) {
  return (
    <span style={{ fontFamily: sans, fontSize: size, fontWeight: weight, color, ...style }}>
      {children}
    </span>
  )
}

/* ─────────────────────────────── surfaces ──────────────────────────── */
export function Panel({
  children, pad = 24, style, onDark, className,
}: { children: ReactNode; pad?: number | string; style?: CSSProperties; onDark?: boolean; className?: string }) {
  return (
    <section className={className} style={{
      background: onDark ? T.walnut : T.card,
      border: `1px solid ${onDark ? T.darkLine : T.cardEdge}`,
      borderRadius: radius.md,
      padding: pad,
      boxShadow: onDark ? shadow.dark : shadow.panel,
      ...style,
    }}>{children}</section>
  )
}

export function Divider({ tone = 'line', style }: { tone?: 'line' | 'gold' | 'dark'; style?: CSSProperties }) {
  const color = tone === 'gold' ? 'rgba(179,144,47,.45)' : tone === 'dark' ? T.darkLine : T.lineSoft
  return <div style={{ height: 1, background: color, ...style }} />
}

/* ─────────────────────────────── controls ──────────────────────────── */
type BtnTone = 'primary' | 'secondary' | 'quiet' | 'onDark'

const BTN: Record<BtnTone, CSSProperties> = {
  primary: { background: T.sienna, color: '#fdf8ef', border: `1px solid ${T.sienna}` },
  secondary: { background: T.olive, color: T.onDark, border: `1px solid ${T.olive}` },
  quiet: { background: 'transparent', color: T.ink2, border: `1px solid ${T.line}` },
  onDark: { background: 'rgba(240,231,214,.10)', color: T.onDark, border: `1px solid ${T.darkLine}` },
}

export function Btn({
  children, tone = 'primary', size = 'md', icon, onClick, disabled, type = 'button', style, title,
}: {
  children: ReactNode
  tone?: BtnTone
  size?: 'sm' | 'md' | 'lg'
  icon?: IconName
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  style?: CSSProperties
  title?: string
}) {
  const pad = size === 'lg' ? '14px 26px' : size === 'sm' ? '8px 14px' : '11px 20px'
  const fontSize = size === 'lg' ? 15 : size === 'sm' ? 13 : 14
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: pad,
        borderRadius: radius.sm, fontFamily: sans, fontWeight: 600, fontSize,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
        transition: 'opacity .18s ease, transform .18s ease',
        ...BTN[tone], ...style,
      }}
    >
      {icon && <Icon name={icon} size={fontSize + 3} strokeWidth={1.4} />}
      {children}
    </button>
  )
}

/** Text-only forward link with the archive arrow. */
export function LinkAction({
  children, onClick, color = T.sienna, style,
}: { children: ReactNode; onClick?: () => void; color?: string; style?: CSSProperties }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none',
        border: 'none', padding: 0, cursor: 'pointer', fontFamily: sans,
        fontSize: 14, fontWeight: 600, color, ...style,
      }}
    >
      {children}
      <Icon name="arrow" size={16} strokeWidth={1.5} />
    </button>
  )
}

/** Archive setup progress. Measures setup — never a person. */
export function Meter({ pct, tone = T.sienna, height = 4 }: { pct: number; tone?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div style={{ height, background: 'rgba(36,28,21,.10)', borderRadius: radius.pill, overflow: 'hidden' }}>
      <div style={{
        width: `${v}%`, height: '100%', background: tone,
        borderRadius: radius.pill, transition: 'width .6s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  )
}

export function PrivacyNote({ children, onDark }: { children?: ReactNode; onDark?: boolean }) {
  const color = onDark ? T.onDark2 : T.ink3
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: sans, fontSize: 13, color }}>
      <Icon name="lock" size={15} strokeWidth={1.3} color={onDark ? T.onDark3 : T.ink3} />
      {children || 'Private by default'}
    </span>
  )
}

/** Small caps metadata row: "May 8, 2024 · 18:42" */
export function Meta({ items, color = T.ink3 }: { items: (string | number | null | undefined)[]; color?: string }) {
  const parts = items.filter(Boolean)
  return (
    <span style={{ fontFamily: sans, fontSize: 13, color }}>{parts.join('  ·  ')}</span>
  )
}

/** Placeholder for photography the archive owner supplies. */
export function ImageSlot({
  label, height = 160, src, style,
}: { label: string; height?: number | string; src?: string | null; style?: CSSProperties }) {
  if (src) {
    return (
      <div style={{ height, borderRadius: radius.sm, overflow: 'hidden', background: T.paperDeep, ...style }}>
        <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }
  return (
    <div style={{
      height, borderRadius: radius.sm, border: `1px solid ${T.cardEdge}`,
      background: `linear-gradient(140deg, ${T.paperDeep}, ${T.paper})`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 8, textAlign: 'center', padding: 16, ...style,
    }}>
      <Icon name="photo" size={22} color={T.ink3} />
      <span style={{ fontFamily: sans, fontSize: 12, color: T.ink3, letterSpacing: '.04em' }}>{label}</span>
    </div>
  )
}
