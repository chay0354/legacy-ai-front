import { apiUrl } from '../lib/apiUrl'
import { sanitizeContent, watchContent, type ThemeContent } from './themeContent'

/** Seed values. Must match `:root` in index.css and the backend sanitizer. */
export const THEME_DEFAULTS = {
  paper: '#eee5d4',
  card: '#faf5eb',
  ink: '#241c15',
  ink2: '#5e5346',
  status: '#5c5246',
  walnut: '#2b211a',
  sienna: '#b05e37',
  olive: '#3c4433',
  gold: '#b3902f',
  onDark: '#f0e7d6',
  onPrimary: '#ffffff',
  error: '#8f3d2c',
  radiusControl: 6,
  radiusCard: 12,
  gutterDesktop: 44,
  gutterMobile: 16,
  contentMax: 1180,
  controlHeight: 44,
} as const

export type ThemeKey = keyof typeof THEME_DEFAULTS
export type ThemeDraft = { [K in ThemeKey]: (typeof THEME_DEFAULTS)[K] }
export type ThemeOverrides = Partial<ThemeDraft>

const COLOR_KEYS = [
  'paper', 'card', 'ink', 'ink2', 'status', 'walnut', 'sienna', 'olive', 'gold', 'onDark', 'onPrimary', 'error',
] as const satisfies readonly ThemeKey[]

export const THEME_NUMBERS: Record<Extract<ThemeKey, 'radiusControl' | 'radiusCard' | 'gutterDesktop' | 'gutterMobile' | 'contentMax' | 'controlHeight'>, { min: number; max: number; css: string }> = {
  radiusControl: { min: 0, max: 20, css: '--la-radius-control' },
  radiusCard: { min: 0, max: 32, css: '--la-radius-card' },
  gutterDesktop: { min: 20, max: 80, css: '--la-gutter-desktop' },
  gutterMobile: { min: 12, max: 32, css: '--la-gutter-mobile' },
  contentMax: { min: 800, max: 1440, css: '--la-content-max' },
  controlHeight: { min: 36, max: 56, css: '--la-control' },
}

const COLOR_CSS: Record<(typeof COLOR_KEYS)[number], string> = {
  paper: '--la-paper',
  card: '--la-card',
  ink: '--la-ink',
  ink2: '--la-ink-2',
  status: '--la-status',
  walnut: '--la-walnut',
  sienna: '--la-sienna',
  olive: '--la-olive',
  gold: '--la-gold',
  onDark: '--la-on-dark',
  onPrimary: '--la-on-primary',
  error: '--la-error',
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function themeDefaults(): ThemeDraft {
  return { ...THEME_DEFAULTS }
}

export function mergeTheme(overrides: unknown): ThemeDraft {
  return { ...THEME_DEFAULTS, ...sanitizeTheme(overrides) }
}

/** Keep only values that differ from the built-in defaults. */
export function sanitizeTheme(input: unknown): ThemeOverrides {
  const src = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const out: Record<string, string | number> = {}
  for (const key of COLOR_KEYS) {
    const value = src[key]
    if (typeof value === 'string' && HEX.test(value)) {
      const hex = value.toLowerCase()
      if (hex !== THEME_DEFAULTS[key]) out[key] = hex
    }
  }
  for (const key of Object.keys(THEME_NUMBERS) as (keyof typeof THEME_NUMBERS)[]) {
    const n = Math.round(Number(src[key]))
    if (!Number.isFinite(n)) continue
    const { min, max } = THEME_NUMBERS[key]
    const clamped = Math.min(max, Math.max(min, n))
    if (clamped !== THEME_DEFAULTS[key]) out[key] = clamped
  }
  return out as ThemeOverrides
}

function paint(draft: ThemeDraft, el: HTMLElement, onlyOverrides: boolean) {
  const overrides = onlyOverrides ? sanitizeTheme(draft) : null
  for (const key of COLOR_KEYS) {
    const value = onlyOverrides ? overrides?.[key] : draft[key]
    if (value) el.style.setProperty(COLOR_CSS[key], value)
    else el.style.removeProperty(COLOR_CSS[key])
  }
  for (const key of Object.keys(THEME_NUMBERS) as (keyof typeof THEME_NUMBERS)[]) {
    const value = onlyOverrides ? overrides?.[key] : draft[key]
    if (value != null) el.style.setProperty(THEME_NUMBERS[key].css, `${value}px`)
    else el.style.removeProperty(THEME_NUMBERS[key].css)
  }
}

/** Paint every seed, including defaults, so a preview does not inherit an older override. */
export function paintTheme(draft: ThemeDraft, el: HTMLElement = document.documentElement) {
  paint(draft, el, false)
}

/** Publish: set overrides and drop properties that match the stylesheet defaults. */
export function applyTheme(overrides: unknown, el: HTMLElement = document.documentElement) {
  paint(mergeTheme(overrides), el, true)
}

function channel(hex: string, index: number) {
  const n = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
}

export function contrastRatio(foreground: string, background: string) {
  if (!HEX.test(foreground) || !HEX.test(background)) return null
  const lum = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2)
  const lighter = Math.max(lum(foreground), lum(background))
  const darker = Math.min(lum(foreground), lum(background))
  return (lighter + 0.05) / (darker + 0.05)
}

const PAIRS: { fg: ThemeKey; bg: ThemeKey; label: string }[] = [
  { fg: 'ink', bg: 'paper', label: 'Body text on paper' },
  { fg: 'status', bg: 'paper', label: 'Status text on paper' },
  { fg: 'onPrimary', bg: 'sienna', label: 'Button label on the primary color' },
  { fg: 'onDark', bg: 'walnut', label: 'Text on walnut' },
]

export function contrastWarnings(draft: ThemeDraft) {
  return PAIRS.flatMap(({ fg, bg, label }) => {
    const ratio = contrastRatio(String(draft[fg]), String(draft[bg]))
    if (ratio == null || ratio >= 4.5) return []
    return [`${label} is ${ratio.toFixed(1)}:1. Aim for 4.5:1.`]
  })
}

export const THEME_PREVIEW_MESSAGE = 'legacy-theme-preview'
export const THEME_PREVIEW_READY = 'legacy-theme-ready'

/** The staff desk posts unsaved tokens into a same-origin preview frame. */
export function postThemePreview(frame: HTMLIFrameElement | null, draft: ThemeDraft, content: ThemeContent) {
  frame?.contentWindow?.postMessage(
    { type: THEME_PREVIEW_MESSAGE, tokens: draft, copy: content.copy, images: content.images, blocks: content.blocks },
    location.origin,
  )
}

export function installThemePreviewBridge() {
  if (new URLSearchParams(location.search).get('themePreview') !== '1') return false
  watchContent({ copy: {}, images: {}, blocks: {} }, 'edit')
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== location.origin) return
    const data = event.data as { type?: string; tokens?: unknown } | null
    if (!data || data.type !== THEME_PREVIEW_MESSAGE) return
    paintTheme(mergeTheme(data.tokens))
    watchContent(sanitizeContent(data), 'edit')
  })
  window.parent.postMessage({ type: THEME_PREVIEW_READY }, location.origin)
  return true
}

export async function bootTheme() {
  if (installThemePreviewBridge()) return
  try {
    const res = await fetch(apiUrl('/api/theme'))
    if (!res.ok) return
    const data = await res.json() as { tokens?: unknown }
    applyTheme(data.tokens || {})
    watchContent(sanitizeContent(data.tokens), 'live')
  } catch {
    /* stylesheet defaults stay in place */
  }
}
