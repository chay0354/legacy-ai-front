export interface AvatarData {
  name: string
  initial: string
  lifespan: string
  meta: string
  tagline: string
  preservedPct: number
  portraitSrc?: string | null
  viewer: { initial: string; name: string; relation: string }
  stages: { label: string; done?: boolean; current?: boolean }[]
  heroStats: { n: string; label: string }[]
  layers: {
    name: string
    count: string
    cov: number
    color: string
    desc: string
    detail: string[]
  }[]
  chapters: { year: string; title: string; body: string; appears: string }[]
  stories: {
    tone: string
    tc: string
    tb: string
    title: string
    year: string
    quote: string
    body: string
    who: string[]
  }[]
  people: {
    initials: string
    name: string
    relation: string
    note: string
    inf: number
    color: string
    ask: number
  }[]
  wisdom: { quote: string; context: string }[]
  phrases: string[]
  preservation: { stats: { n: string; label: string }[]; note: string }
  greeting: string
  suggestions: { q: string; a: string }[]
  gallery: { id: string; imageUrl: string | null; caption: string; title?: string }[]
}

export interface LegacyProfile {
  creator: {
    id?: string
    display_name?: string
    completion_score?: number
    avatar_level?: number
  }
  coverage: { category: string; score: number }[]
  memories: Array<{
    id?: string
    title?: string
    summary?: string
    full_transcript?: string
    category?: string
    importance?: string
    lesson_learned?: string
    year?: string
    emotional_significance?: string
    people_involved?: string[]
  }>
  gallery?: Array<{
    id: string
    image_path?: string
    imageUrl?: string | null
    caption: string
    title?: string | null
    created_at?: string
  }>
  relationships: Array<{
    name: string
    relationship_type?: string
    description?: string
    relationship_summary?: string
    importance_score?: number
    influence_score?: number
  }>
  values: Array<{
    value_name: string
    description?: string
    is_core?: boolean
    origin_story?: string
  }>
  wisdom: Array<{
    title?: string
    advice_statement: string
    supporting_story?: string
    life_category?: string
  }>
  personality?: {
    profile?: Record<string, unknown>
    favorite_phrases?: string[]
  } | null
  sessionCount?: number
  session_summary?: string
  latestSessionSummary?: string | null
  latestSessionStage?: string | null
  latestSessionLabel?: string | null
  openThreads?: Array<{
    id?: string
    title?: string
    origin_statement?: string
    priority?: string
    status?: string
  }>
}

import { stagesForLevel } from './interviewStages'

const LAYER_COLORS: Record<string, string> = {
  personality: '#c06a44',
  advice: '#b3902f',
  values: '#71805c',
  relationships: '#9a6a4b',
  love_family: '#9a6a4b',
  career: '#6b5235',
  childhood: '#a8503a',
  family: '#a8503a',
  identity: '#6b5235',
  life_chapters: '#6b5235',
}

const PEOPLE_COLORS = ['#c06a44', '#6b5235', '#9a6a4b', '#71805c', '#b3902f', '#a8503a']

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 2)
}

function covMap(coverage: LegacyProfile['coverage']) {
  const m: Record<string, number> = {}
  for (const c of coverage || []) m[c.category] = c.score
  return m
}

function importancePriority(imp?: string) {
  const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  return rank[imp || 'medium'] ?? 2
}

function parseYearValue(raw?: string | null): number | null {
  if (!raw || raw === '—') return null
  const digits = String(raw).match(/\b((?:19|20)\d{2})\b/)
  if (!digits) return null
  const year = Number(digits[1])
  return year >= 1900 && year <= 2100 ? year : null
}

/** Pull a 4-digit year from explicit field or interview text (e.g. "in 1977"). */
export function resolveYearFromContent(explicit?: string | null, ...texts: (string | undefined | null)[]): { year: string; sortYear: number } | null {
  const fromField = parseYearValue(explicit)
  if (fromField) return { year: String(fromField), sortYear: fromField }

  for (const text of texts) {
    if (!text) continue
    const match = text.match(/\b(19|20)\d{2}\b/)
    if (match) {
      const sortYear = Number(match[0])
      return { year: match[0], sortYear }
    }
    const decade = text.match(/\b(?:in\s+)?[''](\d{2})\b/i)
    if (decade) {
      const two = Number(decade[1])
      const sortYear = two >= 30 ? 1900 + two : 2000 + two
      return { year: String(sortYear), sortYear }
    }
  }
  return null
}

type TimelineEntry = {
  year: string
  title: string
  body: string
  appears: string
  sortYear: number
  priority: number
}

/** Build chronological timeline from all interview-extracted content with a year. */
export function buildTimelineChapters(profile: LegacyProfile, max = 16): AvatarData['chapters'] {
  const items: TimelineEntry[] = []

  for (const m of profile.memories || []) {
    const resolved = resolveYearFromContent(m.year, m.title, m.summary, m.full_transcript)
    if (!resolved) continue
    items.push({
      year: resolved.year,
      title: m.title || 'A moment',
      body: m.summary || m.full_transcript?.slice(0, 280) || '',
      appears: m.title || 'Interview memory',
      sortYear: resolved.sortYear,
      priority: importancePriority(m.importance) + 2,
    })
  }

  for (const r of profile.relationships || []) {
    const resolved = resolveYearFromContent(null, r.relationship_summary, r.description)
    if (!resolved) continue
    items.push({
      year: resolved.year,
      title: r.name || 'Someone important',
      body: r.relationship_summary || r.description || '',
      appears: `People — ${r.name || 'relationship'}`,
      sortYear: resolved.sortYear,
      priority: 2,
    })
  }

  for (const v of profile.values || []) {
    const resolved = resolveYearFromContent(null, v.origin_story, v.description)
    if (!resolved) continue
    items.push({
      year: resolved.year,
      title: v.value_name || 'A value takes root',
      body: v.origin_story || v.description || '',
      appears: `Values — ${v.value_name || 'core value'}`,
      sortYear: resolved.sortYear,
      priority: v.is_core ? 3 : 2,
    })
  }

  for (const w of profile.wisdom || []) {
    const resolved = resolveYearFromContent(null, w.supporting_story, w.advice_statement)
    if (!resolved) continue
    items.push({
      year: resolved.year,
      title: w.title || w.life_category || 'Lesson learned',
      body: w.supporting_story || w.advice_statement || '',
      appears: w.title || 'Wisdom from interviews',
      sortYear: resolved.sortYear,
      priority: 2,
    })
  }

  for (const t of profile.openThreads || []) {
    const resolved = resolveYearFromContent(null, t.origin_statement, t.title)
    if (!resolved) continue
    items.push({
      year: resolved.year,
      title: t.title || 'A thread from conversation',
      body: t.origin_statement || '',
      appears: t.title || 'Interview thread',
      sortYear: resolved.sortYear,
      priority: 1,
    })
  }

  const seen = new Set<string>()
  const deduped = items.filter((item) => {
    const key = `${item.sortYear}|${item.title.toLowerCase().trim()}|${item.body.slice(0, 80).toLowerCase().trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  deduped.sort((a, b) => a.sortYear - b.sortYear || b.priority - a.priority)

  const chapters = deduped.slice(0, max).map(({ year, title, body, appears }) => ({
    year, title, body, appears,
  }))

  if (!chapters.length) {
    chapters.push({
      year: '—',
      title: 'Foundation session',
      body: profile.session_summary || profile.latestSessionSummary || 'The first conversations that began preserving this legacy.',
      appears: profile.latestSessionLabel || 'Session One',
    })
  }

  return chapters
}

function importanceTone(imp?: string) {
  const t: Record<string, string> = {
    critical: 'Turning point',
    high: 'Memory',
    medium: 'Story',
    low: 'Moment',
  }
  return t[imp || 'medium'] || 'Story'
}

export function mapProfileToAvatarData(
  profile: LegacyProfile,
  viewer?: { name: string; relation?: string },
): AvatarData {
  const name = profile.creator.display_name || 'Legacy'
  const firstName = name.split(' ')[0]
  const cov = covMap(profile.coverage)
  const pct = profile.creator.completion_score ?? 0
  const level = profile.creator.avatar_level ?? 0

  const personalityCov = cov.personality ?? Math.min(pct, 40)
  const valuesCov = cov.values ?? 0
  const relCov = Math.max(cov.relationships ?? 0, cov.love_family ?? 0)
  const storiesCov = Math.max(cov.childhood ?? 0, cov.family ?? 0, cov.life_chapters ?? 0)
  const factsCov = Math.max(cov.identity ?? 0, cov.career ?? 0, cov.life_chapters ?? 0)
  const wisdomCov = cov.advice ?? Math.round((valuesCov + relCov) / 2)

  const phrases = profile.personality?.favorite_phrases?.length
    ? profile.personality.favorite_phrases.map((p) => `"${p}"`)
    : (profile.personality?.profile?.communication_style
      ? [`"${String(profile.personality.profile.communication_style).slice(0, 48)}…"`]
      : ['"Your story is still being written."'])

  const suggestions = (profile.wisdom || []).slice(0, 5).map((w) => ({
    q: w.life_category ? `What do you think about ${w.life_category.toLowerCase()}?` : 'What advice would you give me?',
    a: w.advice_statement,
  }))

  if (!suggestions.length) {
    suggestions.push({
      q: 'What would you want future generations to know?',
      a: profile.session_summary || 'Take your time with the people you love. That is the whole of it.',
    })
  }

  const peopleInitials: Record<string, string> = {}
  const people = (profile.relationships || []).map((r, i) => {
    const ini = initials(r.name)
    peopleInitials[r.name] = ini
    const inf = Math.max(1, Math.min(5, Math.round((r.importance_score ?? 50) / 20)))
    return {
      initials: ini,
      name: r.name,
      relation: r.relationship_type || 'Important person',
      note: r.relationship_summary || r.description || '',
      inf,
      color: PEOPLE_COLORS[i % PEOPLE_COLORS.length],
      ask: Math.min(i, suggestions.length - 1),
    }
  })

  const storyColors = [
    { tc: '#6b5235', tb: 'rgba(107,82,53,.12)' },
    { tc: '#c06a44', tb: 'rgba(192,106,68,.12)' },
    { tc: '#b3902f', tb: 'rgba(179,144,47,.14)' },
    { tc: '#71805c', tb: 'rgba(113,128,92,.14)' },
  ]

  const stories = (profile.memories || []).slice(0, 4).map((m, i) => {
    const who = (m.people_involved || [])
      .map((p) => peopleInitials[p] || initials(p))
      .filter(Boolean)
      .slice(0, 3)
    const { tc, tb } = storyColors[i % storyColors.length]
    return {
      tone: importanceTone(m.importance),
      tc,
      tb,
      title: m.title || 'A memory',
      year: resolveYearFromContent(m.year, m.title, m.summary, m.full_transcript)?.year || m.year || '—',
      quote: m.summary ? `"${m.summary.slice(0, 160)}${m.summary.length > 160 ? '…' : ''}"` : '"…"',
      body: m.lesson_learned || m.emotional_significance || m.summary || '',
      who: who.length ? who : people.slice(0, 1).map((p) => p.initials),
    }
  })

  const chapters = buildTimelineChapters(profile)

  const valueDetails = (profile.values || []).slice(0, 4).map((v) =>
    v.is_core ? `${v.value_name} — core value` : v.value_name,
  )

  return {
    name,
    initial: initials(name).slice(0, 1) || '?',
    lifespan: '—',
    meta: `LEGACY PRESERVED · ${pct}% COMPLETE`,
    tagline: profile.latestSessionSummary
      || profile.session_summary
      || (profile.personality?.profile?.communication_style
        ? String(profile.personality.profile.communication_style)
        : `Everything ${firstName} shared in their interviews — stories, values, and wisdom preserved.`),
    preservedPct: pct,
    portraitSrc: null,
    viewer: {
      initial: viewer?.name?.[0]?.toUpperCase() || 'Y',
      name: viewer?.name || 'You',
      relation: viewer?.relation || 'family',
    },
    stages: stagesForLevel(level).map(({ label, done, current }) => ({ label, done, current })),
    heroStats: [
      { n: String(profile.sessionCount ?? 1), label: 'sessions' },
      { n: String(profile.memories?.length ?? 0), label: 'stories preserved' },
      { n: String(profile.relationships?.length ?? 0), label: 'people captured' },
    ],
    layers: [
      {
        name: 'Personality',
        count: `${phrases.length} phrases · tone`,
        cov: personalityCov,
        color: LAYER_COLORS.personality,
        desc: String(profile.personality?.profile?.communication_style || 'How they speak, laugh, and show up in a room.'),
        detail: phrases.slice(0, 4).map((p) => p.replace(/^"|"$/g, '')),
      },
      {
        name: 'Wisdom',
        count: `${profile.wisdom?.length ?? 0} lessons preserved`,
        cov: wisdomCov,
        color: LAYER_COLORS.advice,
        desc: 'Advice earned through experience — what they want you to carry forward.',
        detail: (profile.wisdom || []).slice(0, 4).map((w) => w.advice_statement),
      },
      {
        name: 'Values',
        count: `${profile.values?.length ?? 0} core values`,
        cov: valuesCov,
        color: LAYER_COLORS.values,
        desc: 'What guided their decisions and what they would never compromise.',
        detail: valueDetails.length ? valueDetails : ['Still being discovered in conversation'],
      },
      {
        name: 'Relationships',
        count: `${profile.relationships?.length ?? 0} people`,
        cov: relCov,
        color: LAYER_COLORS.relationships,
        desc: 'The people who shaped who they became.',
        detail: people.slice(0, 4).map((p) => `${p.name} — ${p.relation}`),
      },
      {
        name: 'Stories',
        count: `${profile.memories?.length ?? 0} stories`,
        cov: storiesCov,
        color: '#a8503a',
        desc: 'The moments they returned to again and again.',
        detail: (profile.memories || []).slice(0, 4).map((m) => m.title || 'Untitled story'),
      },
      {
        name: 'Facts',
        count: 'life chapters',
        cov: factsCov,
        color: '#6b5235',
        desc: 'Dates, places, and the scaffolding a life is built on.',
        detail: chapters.slice(0, 4).map((c) => `${c.year} — ${c.title}`),
      },
    ],
    chapters,
    stories: stories.length ? stories : [{
      tone: 'Beginning',
      tc: '#71805c',
      tb: 'rgba(113,128,92,.14)',
      title: 'Foundation interview',
      year: '—',
      quote: `"${(profile.session_summary || 'Your legacy begins with a single conversation.').slice(0, 120)}"`,
      body: 'Complete more sessions to unlock richer anchor stories.',
      who: people.slice(0, 1).map((p) => p.initials),
    }],
    people: people.length ? people : [{
      initials: '?',
      name: 'More to come',
      relation: 'From future sessions',
      note: 'Relationships appear as you share more in interview.',
      inf: 3,
      color: '#9a8d79',
      ask: 0,
    }],
    wisdom: (profile.wisdom || []).slice(0, 4).map((w) => ({
      quote: w.advice_statement,
      context: w.supporting_story || w.life_category || '',
    })),
    phrases,
    preservation: {
      stats: [
        { n: String(profile.sessionCount ?? 1), label: 'sessions' },
        { n: String(profile.memories?.length ?? 0), label: 'stories' },
        { n: String(profile.relationships?.length ?? 0), label: 'people' },
        { n: String(profile.values?.length ?? 0), label: 'values' },
        { n: String(profile.wisdom?.length ?? 0), label: 'lessons' },
      ],
      note: 'Preserved through Legacy AI interviews across Foundation, Enriched, and Legacy stages.',
    },
    greeting: `Hello. Pull up a chair — ask me anything you like, and I'll answer the way I always would have.`,
    suggestions,
    gallery: (profile.gallery || []).map((g) => ({
      id: g.id,
      imageUrl: g.imageUrl ?? null,
      caption: g.caption,
      title: g.title || undefined,
    })),
  }
}
