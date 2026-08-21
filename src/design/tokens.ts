/**
 * [Name TBD] — visual tokens. Direction: Warm Editorial Heirloom.
 *
 * Colour roles (from the product + website direction handoff):
 *   paper / stone  reading surfaces, transcripts, entries, forms — paper, not blank beige
 *   walnut         hero atmosphere, voice panels, quotes, editorial bands — a room, not a black panel
 *   olive          side navigation, active states, privacy indicators, secondary buttons
 *   sienna         primary CTAs, progress, the important next step — used sparingly
 *   gold           dividers, chapter numbers, quote marks, quiet heirloom details — sparingly
 *
 * Target value balance: ~50% paper, ~25% walnut/olive structure,
 * ~15% photography/material, ~10% sienna/gold accent.
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
  ink3: '#8c8071',

  walnut: '#2b211a',
  walnutDeep: '#1e1712',
  walnutSoft: '#3b2d24',

  olive: '#3c4433',
  oliveDeep: '#2e3527',
  oliveSoft: '#5b6647',

  sienna: '#b05e37',
  siennaDeep: '#964d2b',
  gold: '#b3902f',

  onDark: '#f0e7d6',
  onDark2: 'rgba(240,231,214,.68)',
  onDark3: 'rgba(240,231,214,.44)',
  darkLine: 'rgba(240,231,214,.15)',
} as const

export const serif = "'Newsreader', Georgia, serif"
export const sans =
  "'Source Sans 3', 'Avenir Next', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
/** Retained only for legacy call sites; new work uses `sans`. */
export const mono = sans

export const radius = { sm: 4, md: 8, lg: 14, pill: 999 } as const

export const shadow = {
  panel: '0 1px 2px rgba(36,28,21,.05)',
  lift: '0 10px 30px rgba(36,28,21,.14)',
  dark: '0 14px 40px rgba(20,15,11,.30)',
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
