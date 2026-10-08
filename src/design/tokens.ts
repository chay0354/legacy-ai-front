/**
 * Legacy AI — visual tokens. Direction: Warm Editorial Heirloom.
 *
 * One walnut family for every structural dark. The homepage hero gradient
 * (#17110D → #4A3323) is the only documented exception.
 *
 * Roles, not page-specific colors:
 *   paper / card     reading surfaces
 *   walnut           headers, product shell, drawer, footer, dark bands
 *   sienna           primary action
 *   ink / status     body and informative copy (4.5:1 on paper)
 *   gold             quiet emphasis on dark — never body copy on cream
 */

/** Values resolve from :root. The staff desk publishes overrides onto these variables. */
export const T = {
  paper: 'var(--la-paper)',
  paperDeep: 'var(--la-paper-deep)',
  card: 'var(--la-card)',
  cardEdge: 'var(--la-card-edge)',
  line: 'var(--la-line)',
  lineSoft: 'var(--la-line-soft)',

  ink: 'var(--la-ink)',
  ink2: 'var(--la-ink-2)',
  /** Informative / status / privacy — 4.5:1 on paper. Do not use for disabled. */
  ink3: 'var(--la-status)',
  status: 'var(--la-status)',

  walnut: 'var(--la-walnut)',
  walnutDeep: 'var(--la-walnut-deep)',
  walnutMid: 'var(--la-walnut-mid)',
  walnutSoft: 'var(--la-walnut-soft)',

  olive: 'var(--la-olive)',
  oliveDeep: 'var(--la-olive-deep)',
  oliveSoft: 'var(--la-olive-soft)',

  sienna: 'var(--la-sienna)',
  siennaDeep: 'var(--la-sienna-deep)',
  gold: 'var(--la-gold)',

  onDark: 'var(--la-on-dark)',
  onDark2: 'var(--la-on-dark-2)',
  onDark3: 'var(--la-on-dark-3)',
  darkLine: 'var(--la-dark-line)',

  focus: 'var(--la-sienna)',
  error: 'var(--la-error)',
  success: 'var(--la-olive)',
  warning: 'var(--la-sienna-deep)',
  disabled: 'var(--la-disabled)',
  onPrimary: 'var(--la-on-primary)',
} as const

/** One heading standard for the whole site: Newsreader 600; italic emphasis inside a heading steps down to 400. */
export const heading = { weight: 600, italicWeight: 400, cardWeight: 500 } as const

export const serif = "'Newsreader', 'Newsreader Fallback', Georgia, serif"
export const sans =
  "'Source Sans 3', 'Source Sans 3 Fallback', system-ui, sans-serif"
/** Retained only for legacy call sites; new work uses `sans`. */
export const mono = sans

/** Control radius for buttons/fields. Card radius for panels. Pill only for segmented choices. */
export const radius = {
  sm: 'var(--la-radius-control)',
  md: 'var(--la-radius-card)',
  lg: 'var(--la-radius-card)',
  control: 'var(--la-radius-control)',
  card: 'var(--la-radius-card)',
  pill: 999,
} as const

export const space = {
  4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32, 48: 48, 64: 64,
} as const

export const layout = {
  gutterMobile: 'var(--la-gutter-mobile)',
  gutterDesktop: 'var(--la-gutter-desktop)',
  contentMax: 'var(--la-content-max)',
  controlHeight: 'var(--la-control)',
} as const

export const type = {
  display: { desktop: 40, mobile: 28 },
  title: { desktop: 28, mobile: 22 },
  question: { desktop: 28, mobile: 20 },
  body: 16,
  label: 14,
  meta: 13,
} as const

export const shadow = {
  panel: '0 1px 2px rgba(36,28,21,.05)',
  lift: '0 8px 24px rgba(36,28,21,.10)',
  dark: '0 14px 40px rgba(20,15,11,.30)',
} as const

export const focusRing = {
  outline: `2px solid ${T.focus}`,
  outlineOffset: 3,
} as const

/** Subtle paper grain — texture without scrapbook. */
export const paperTexture =
  'radial-gradient(rgba(36,28,21,.035) 1px, transparent 1px) 0 0 / 4px 4px'

/**
 * Compatibility palette for screens carried over from the previous design.
 * Old key names are kept so those files reskin without structural edits.
 */
export const C = {
  paper: T.paper,
  panel: T.paperDeep,
  card: T.card,
  ink: T.ink,
  ink2: T.ink2,
  ink3: T.ink3,
  line: T.line,
  cardLine: T.cardEdge,
  rowLine: T.lineSoft,
  terra: T.sienna,
  umber: T.walnutSoft,
  gold: T.gold,
  sage: T.olive,
} as const
