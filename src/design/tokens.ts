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

export const T = {
  paper: '#eee5d4',
  paperDeep: '#e5dac5',
  card: '#faf5eb',
  cardEdge: '#ded0b6',
  line: '#d8c9ae',
  lineSoft: '#e8dfcb',

  ink: '#241c15',
  ink2: '#5e5346',
  /** Informative / status / privacy — 4.5:1 on paper. Do not use for disabled. */
  ink3: '#5c5246',
  status: '#5c5246',

  walnut: '#2b211a',
  walnutDeep: '#17110d',
  walnutMid: '#4a3323',
  walnutSoft: '#3b2d24',

  olive: '#3c4433',
  oliveDeep: '#2e3527',
  oliveSoft: '#5b6647',

  sienna: '#b05e37',
  siennaDeep: '#964d2b',
  gold: '#b3902f',

  onDark: '#f0e7d6',
  onDark2: 'rgba(240,231,214,.86)',
  onDark3: 'rgba(240,231,214,.70)',
  darkLine: 'rgba(240,231,214,.18)',

  focus: '#b05e37',
  error: '#8f3d2c',
  success: '#3c4433',
  warning: '#964d2b',
  disabled: 'rgba(36,28,21,.38)',
  onPrimary: '#ffffff',
} as const

export const serif = "'Newsreader', 'Newsreader Fallback', Georgia, serif"
export const sans =
  "'Source Sans 3', 'Source Sans 3 Fallback', system-ui, sans-serif"
/** Retained only for legacy call sites; new work uses `sans`. */
export const mono = sans

/** Control radius for buttons/fields. Card radius for panels. Pill only for segmented choices. */
export const radius = { sm: 6, md: 12, lg: 12, control: 6, card: 12, pill: 999 } as const

export const space = {
  4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32, 48: 48, 64: 64,
} as const

export const layout = {
  gutterMobile: 16,
  gutterDesktop: 44,
  contentMax: 1180,
  controlHeight: 44,
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
