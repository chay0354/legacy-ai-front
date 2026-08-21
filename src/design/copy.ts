/**
 * Locked product + website language. Import from here rather than typing
 * strings inline, so the terminology rules stay enforceable in one place.
 *
 * Progress measures ARCHIVE SETUP — never the completeness of a person.
 * Website POV is the creator, second person: you, your archive, your stories.
 */

export const BRAND = '[Name TBD]'
export const BRAND_SUB = 'Private Archive'

export const NAV = {
  overview: 'Overview',
  interview: 'Interview',
  stories: 'Stories',
  voice: 'Voice memories',
  photos: 'Photos & documents',
  people: 'People',
  access: 'Family Access',
  settings: 'Settings',
} as const

export const SITE_NAV = [
  { label: 'About', to: '/about' },
  { label: 'How it works', to: '/how-it-works' },
  { label: 'The Archive', to: '/the-archive' },
  { label: 'Pricing', to: '/pricing' },
] as const

export const CTA = {
  begin: 'Begin your archive',
  start: 'Start the archive',
  build: 'Build the archive',
  guided: 'Start with a guided interview',
  learn: 'Learn how it works',
  seeBuilt: 'See how the archive is built',
  continueInterview: 'Continue interview',
  beginInterview: 'Begin interview',
  addVoicePhoto: 'Add voice & photo',
  recordVoice: 'Record a voice memory',
  addEntry: 'Add an entry',
  invite: 'Invite family',
  prepareAccess: 'Prepare family access',
  review: 'Review answers',
  edit: 'Edit entry',
  manage: 'Manage access',
  transcript: 'View transcript',
  saveLater: 'Save for later',
  signIn: 'Sign in',
} as const

export const STAGES = {
  foundation: {
    label: 'Foundation',
    note: 'Gather the core stories, people, and context.',
  },
  enrichment: {
    label: 'Enrichment',
    note: 'Add voice, photographs, memories, and meaning.',
  },
  family: {
    label: 'Family Archive',
    note: 'Review, organize, and prepare family access.',
  },
} as const

export const DASHBOARD_TAGLINE = 'Your archive is taking shape, one story at a time.'

/** e.g. "Archive setup: 34% complete" */
export const archiveSetupLabel = (pct: number) => `Archive setup: ${pct}% complete`

/** e.g. "Foundation complete · Enrichment in progress" */
export function stageStatusLine(level: number) {
  if (level >= 3) return 'Foundation complete · Enrichment complete · Family Archive ready'
  if (level >= 2) return 'Foundation complete · Enrichment complete · Family Archive in progress'
  if (level >= 1) return 'Foundation complete · Enrichment in progress'
  return 'Foundation in progress · Family Archive not yet ready'
}

/** e.g. "6 stories gathered · 3 voice memories added · 5 people added · 12 photographs added" */
export function countsLine(counts: {
  stories: number
  voice: number
  people: number
  photographs: number
}) {
  const one = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`
  return [
    `${one(counts.stories, 'story', 'stories')} gathered`,
    `${one(counts.voice, 'voice memory', 'voice memories')} added`,
    `${one(counts.people, 'person', 'people')} added`,
    `${one(counts.photographs, 'photograph')} added`,
  ].join(' · ')
}

/** Recent activity labels must match the object they describe. */
export const ACTIVITY_LABEL = {
  story: 'Story gathered',
  voice: 'Voice memory added',
  photograph: 'Photograph added',
  document: 'Document added',
  person: 'Person added',
  access: 'Family access updated',
} as const

export const STATUS = {
  saved: 'Saved',
  draftSaved: 'Draft saved',
  private: 'Private by default',
  onlyInvited: 'Only invited family can access this',
  sourced: 'This answer is based on recorded archive material',
  unknown: 'The archive does not have enough information to answer that yet',
} as const

export const TRUST = [
  'Private by default',
  'Shared only with invited family',
  'Built only from what you choose to share',
  'The archive should say when it does not know',
  'Voice and likeness require explicit permission',
] as const

export const BAND = {
  eyebrow: 'Private Archive',
  line: 'Your stories, voice, and memories, kept with care.',
  emotional: 'Every story you add now gives your family something real to return to.',
  link: 'Learn how the archive is built',
  privacy: 'Built privately. Shared only with the people you choose.',
} as const

export const HERO = {
  headline: ['Gather your stories.', 'Keep them close.'],
  sub: 'Record your voice. Add your memories. Keep your stories for the people you choose.',
  standfirst: 'A private archive of the stories only you can tell.',
} as const

export const HOW_IT_WORKS = [
  {
    n: 'I',
    title: 'Begin with guided conversation',
    body: 'An interview that asks the questions your family would ask, one at a time, at your pace.',
  },
  {
    n: 'II',
    title: 'Add voice, photos, and family context',
    body: 'Record a voice memory. Add photographs, letters, and the people who belong to each story.',
  },
  {
    n: 'III',
    title: 'Review and shape the archive',
    body: 'Every entry stays yours to edit. Correct a date, add what you left out, remove what you would rather not keep.',
  },
  {
    n: 'IV',
    title: 'Choose who can access it',
    body: 'Invite family by name. Set what each person can see. Change your mind at any time.',
  },
  {
    n: 'V',
    title: 'Let invited family return to your stories in your own words',
    body: 'They read and hear what you recorded — and nothing you did not.',
  },
] as const
