import type { LegacyProfile } from './mapAvatarData'
import type { MemberRow, Role } from './api'
import { ROLES } from './permissions'
import { continueInterviewAction, stageDisplayName, stagesForLevel } from './interviewStages'
import type { RoleHomeData } from '../components/RoleHome'

const ACCENTS = ['#c06a44', '#6b5235', '#9a6a4b', '#71805c', '#b3902f', '#a8503a']
const MEMORY_COLORS = ['#a8503a', '#b3902f', '#c06a44', '#71805c', '#6b5235']

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 2) || '?'
}

function stageForLevel(level: number) {
  if (level >= 3) return 'Legacy'
  if (level >= 2) return 'Legacy'
  if (level >= 1) return 'Enriched'
  return 'Foundation'
}

interface MapArgs {
  profile: LegacyProfile
  viewerName: string
  members?: MemberRow[]
}

export function mapProfileToRoleHomeData({ profile, viewerName, members = [] }: MapArgs): RoleHomeData {
  const fullName = profile.creator.display_name || 'This legacy'
  const subjectName = fullName.split(' ')[0] || fullName
  const pct = profile.creator.completion_score ?? 0
  const level = profile.creator.avatar_level ?? 0

  const stages = stagesForLevel(level)
  const interviewAction = continueInterviewAction(level)

  const memories: RoleHomeData['memories'] = (profile.memories || []).slice(0, 5).map((m, i) => ({
    id: (m as { id?: string }).id,
    title: m.title || m.summary?.slice(0, 48) || 'A memory',
    summary: m.summary || '',
    category: m.category,
    year: m.year,
    meta: [m.category ? m.category[0].toUpperCase() + m.category.slice(1) : 'Story', m.year, m.importance].filter(Boolean).join(' · '),
    color: MEMORY_COLORS[i % MEMORY_COLORS.length],
  }))

  const gallery: RoleHomeData['gallery'] = (profile.gallery || []).map((g) => ({
    id: g.id,
    imageUrl: g.imageUrl ?? null,
    caption: g.caption,
    title: g.title || undefined,
  }))

  const nonCreators = members.filter((m) => m.role !== ROLES.CREATOR)
  const admins: RoleHomeData['admins'] = nonCreators
    .filter((m) => m.role === ROLES.ADMINISTRATOR)
    .map((m, i) => {
      const name = m.name || m.email || 'Administrator'
      return { initials: initials(name), name, relation: 'Administrator', color: ACCENTS[i % ACCENTS.length] }
    })

  const family: RoleHomeData['family'] = nonCreators.map((m, i) => {
    const name = m.name || m.email || 'Family member'
    return {
      initials: initials(name),
      name,
      relation: m.email || 'Family',
      role: m.role as Role,
      status: 'Active',
      color: ACCENTS[i % ACCENTS.length],
    }
  })

  const suggestions = (profile.wisdom || []).slice(0, 4).map((w) =>
    w.life_category ? `What did you learn about ${w.life_category.toLowerCase()}?` : 'What advice would you give me?',
  )
  while (suggestions.length < 4) {
    suggestions.push(
      ['What were you most proud of?', 'Tell me about your childhood.', 'How did you meet your love?', 'What should I remember?'][suggestions.length],
    )
  }

  const firstMemory = (profile.memories || [])[0]
  const storyOfDay = {
    year: firstMemory?.year || '—',
    title: firstMemory?.title || 'A story to come',
    quote: firstMemory?.summary
      ? `“${firstMemory.summary.slice(0, 160)}${firstMemory.summary.length > 160 ? '…' : ''}”`
      : '“More stories are preserved with every conversation.”',
  }

  const avatarNote =
    profile.latestSessionSummary ||
    profile.session_summary ||
    `${subjectName}’s legacy is ${pct}% preserved. Keep going to deepen every layer.`

  const stageName = profile.latestSessionStage
    ? stageDisplayName(profile.latestSessionStage as 'foundation' | 'enriched' | 'legacy')
    : null

  return {
    subjectName,
    subjectFull: fullName,
    viewerName,
    preservedPct: pct,
    stage: stageForLevel(level),
    stages,
    avatarNote,
    lastSession: stageName && profile.latestSessionLabel
      ? `Updated from ${stageName} interview · ${profile.memories?.length ?? 0} stories · ${profile.sessionCount ?? 1} session${(profile.sessionCount ?? 1) === 1 ? '' : 's'}`
      : `${profile.sessionCount ?? 1} session${(profile.sessionCount ?? 1) === 1 ? '' : 's'} · ${profile.memories?.length ?? 0} stories preserved`,
    creatorActions: level >= 3
      ? [
          { glyph: '✓', color: '#71805c', title: 'All stages complete', note: 'Foundation, Enriched & Legacy preserved', action: 'view_avatar' },
          { glyph: '✚', color: '#7a5236', title: 'Add a memory', note: 'A story, a photo, a note', action: 'add_memory' },
          { glyph: '❏', color: '#71805c', title: 'Upload photos', note: 'Faces, places, letters', action: 'upload_media' },
          { glyph: '♪', color: '#b3902f', title: 'Record voice', note: 'Family hears you on avatar page', action: 'record_voice' },
        ]
      : [
          { glyph: '❝', color: '#c06a44', title: interviewAction.title, note: interviewAction.note, action: 'complete_interview' },
          { glyph: '✚', color: '#7a5236', title: 'Add a memory', note: 'A story, a photo, a note', action: 'add_memory' },
          { glyph: '❏', color: '#71805c', title: 'Upload photos', note: 'Faces, places, letters', action: 'upload_media' },
          { glyph: '♪', color: '#b3902f', title: 'Record voice', note: 'Family hears you on avatar page', action: 'record_voice' },
        ],
    memories,
    gallery,
    admins,
    family,
    suggestions,
    browse: [
      { kicker: `${profile.memories?.length ?? 0} stories`, color: '#a8503a', title: 'Stories', note: 'The moments they kept coming back to.', cta: 'Browse stories' },
      { kicker: `${profile.relationships?.length ?? 0} people`, color: '#7a5236', title: 'Their life', note: 'The people and places that shaped them.', cta: 'Walk the timeline' },
      { kicker: `${profile.wisdom?.length ?? 0} lessons`, color: '#b3902f', title: 'Wisdom', note: 'What they wanted you to carry forward.', cta: 'Read their wisdom' },
    ],
    storyOfDay,
  }
}
