import {
  createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import {
  accessApi, avatarApi, interviewApi, permissionsForRole,
  type AvatarAssetsResponse, type MemberRow, type Membership, type Role,
} from '../../lib/api'
import type { LegacyProfile } from '../../lib/mapAvatarData'
import { ACTIONS, can, normalizeRole, resolveViewerRole } from '../../lib/permissions'
import { ACTIVITY_LABEL } from '../../design/copy'
import { editingSite } from '../../lib/siteEdit'

const SAMPLE_PROFILE: LegacyProfile = {
  creator: { id: 'sample', display_name: 'Alex Morgan', completion_score: 68, avatar_level: 2 },
  coverage: [
    { category: 'family', score: 70 },
    { category: 'work', score: 55 },
  ],
  memories: [
    { id: 'm1', title: 'Sunday mornings', summary: 'The kitchen radio, fresh bread, and a few quiet hours before the week began.', category: 'Family', year: '1978', people_involved: ['Ruth Morgan'] },
    { id: 'm2', title: 'The repair shop', summary: 'A small shop on the corner, and the rule that you finish what you start.', category: 'Work', year: '1986', people_involved: ['Sam Morgan'] },
    { id: 'm3', title: 'The move across town', summary: 'One truck, two children, and the first night in the new house.', category: 'Home', year: '1994', people_involved: ['Jordan Lee'] },
  ],
  gallery: [
    { id: 'g1', caption: 'The front step, late afternoon', title: 'Front step' },
    { id: 'g2', caption: 'A birthday at the kitchen table', title: 'Birthday' },
  ],
  relationships: [
    { name: 'Ruth Morgan', relationship_type: 'Mother', description: 'Kept the house steady.', importance_score: 9 },
    { name: 'Sam Morgan', relationship_type: 'Father', description: 'Ran the repair shop.', importance_score: 8 },
    { name: 'Jordan Lee', relationship_type: 'Child', description: 'Asks for the old stories.', importance_score: 8 },
  ],
  values: [{ value_name: 'Keep your word', description: 'Say what you will do, then do it.', is_core: true }],
  wisdom: [{ title: 'Call them', advice_statement: 'Do not wait years to say the thing that matters.', life_category: 'Family' }],
  sessionCount: 2,
  latestSessionSummary: 'Two conversations so far: family, work, and the move across town.',
}

const SAMPLE_ASSETS: AvatarAssetsResponse = {
  creatorId: 'sample',
  displayName: 'Alex Morgan',
  assets: {
    creator_id: 'sample',
    voice_id: null,
    voice_status: 'ready',
    voice_sample_path: 'sample',
    portrait_path: null,
    idle_video_path: null,
    speaking_video_path: null,
  },
  voiceCloned: true,
  hasPortrait: false,
  liveReady: false,
}

const SAMPLE_MEMBERS: MemberRow[] = [
  { user_id: 'sample-owner', role: 'creator', created_at: '2024-01-01T00:00:00.000Z', email: null, name: 'Alex Morgan' },
  { user_id: 'sample-family', role: 'member', created_at: '2024-03-01T00:00:00.000Z', email: null, name: 'Jordan Lee' },
]

const SAMPLE_MEMBERSHIPS: Membership[] = [
  {
    creatorId: 'sample',
    role: 'creator',
    displayName: 'Alex Morgan',
    completionScore: 68,
    avatarLevel: 2,
    isOwner: true,
    permissions: permissionsForRole('creator'),
  },
]

export interface ArchiveActivity {
  label: string
  title: string
  detail?: string
  icon: 'story' | 'voice' | 'photo' | 'people' | 'lock'
}

export interface ArchiveCounts {
  stories: number
  voice: number
  people: number
  photographs: number
  wisdom: number
  values: number
}

export interface ArchiveContext {
  loading: boolean
  error: string | null
  profile: (LegacyProfile & { role?: Role }) | null
  assets: AvatarAssetsResponse | null
  members: MemberRow[]
  memberships: Membership[]
  role: Role
  creatorId?: string
  creatorName: string
  portraitUrl: string | null
  level: number
  setupPct: number
  counts: ArchiveCounts
  activity: ArchiveActivity[]
  locked: boolean
  reload: () => void
}

const ArchiveDataContext = createContext<ArchiveContext | null>(null)

export function useArchiveLoader(creatorIdParam?: string): ArchiveContext {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<(LegacyProfile & { role?: Role }) | null>(null)
  const [assets, setAssets] = useState<AvatarAssetsResponse | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])
  const profileRef = useRef(profile)
  profileRef.current = profile

  useEffect(() => {
    if (editingSite()) {
      setProfile({ ...SAMPLE_PROFILE, role: 'creator' })
      setAssets(SAMPLE_ASSETS)
      setMembers(SAMPLE_MEMBERS)
      setMemberships(SAMPLE_MEMBERSHIPS)
      setError(null)
      setLoading(false)
      return
    }
    let active = true
    const loadedId = profileRef.current?.creator?.id
    const switching = Boolean(creatorIdParam && loadedId && loadedId !== creatorIdParam)
    if (!profileRef.current || switching) {
      if (switching) {
        setProfile(null)
        setAssets(null)
        setMembers([])
        setMemberships([])
      }
      setLoading(true)
    }
    setError(null)
    Promise.all([
      interviewApi.getProfile(creatorIdParam),
      avatarApi.getAssets({ creatorId: creatorIdParam }).catch(() => null),
      accessApi.me().catch(() => null),
    ])
      .then(([p, a, me]) => {
        if (!active) return
        const cid = p.creator?.id || creatorIdParam
        const membership = me?.memberships.find((m) => m.creatorId === cid)
        const role = resolveViewerRole(
          membership?.isOwner,
          membership?.role,
          p.role,
        )
        setProfile({ ...p, role })
        setAssets(a)
        setMemberships(me?.memberships || [])
        if (cid && (can(role, ACTIONS.MANAGE_ACCESS) || can(role, ACTIONS.INVITE_USER))) {
          accessApi.members(cid)
            .then((m) => { if (active) setMembers(m.members) })
            .catch(() => { /* roster is optional */ })
        } else if (active) {
          setMembers([])
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not open this archive')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [creatorIdParam, tick])

  const role = (normalizeRole(profile?.role) || 'member') as Role
  const creatorName = profile?.creator?.display_name || 'This archive'
  const level = profile?.creator?.avatar_level ?? 0
  const setupPct = profile?.creator?.completion_score ?? 0

  const counts = useMemo<ArchiveCounts>(() => ({
    stories: profile?.memories?.length ?? 0,
    voice: assets?.assets?.voice_sample_path ? 1 : 0,
    people: profile?.relationships?.length ?? 0,
    photographs: profile?.gallery?.length ?? 0,
    wisdom: profile?.wisdom?.length ?? 0,
    values: profile?.values?.length ?? 0,
  }), [profile, assets])

  const activity = useMemo<ArchiveActivity[]>(() => {
    const rows: ArchiveActivity[] = []
    for (const m of (profile?.memories || []).slice(0, 3)) {
      rows.push({
        label: ACTIVITY_LABEL.story,
        title: m.title || m.summary?.slice(0, 46) || 'Untitled entry',
        detail: [m.category, m.year].filter(Boolean).join(' · ') || undefined,
        icon: 'story',
      })
    }
    if (assets?.assets?.voice_sample_path) {
      rows.push({ label: ACTIVITY_LABEL.voice, title: 'Setup recording, not a story', icon: 'voice' })
    }
    for (const g of (profile?.gallery || []).slice(0, 2)) {
      rows.push({
        label: ACTIVITY_LABEL.photograph,
        title: g.title || g.caption || 'Photograph',
        icon: 'photo',
      })
    }
    for (const r of (profile?.relationships || []).slice(0, 2)) {
      rows.push({
        label: ACTIVITY_LABEL.person,
        title: r.name,
        detail: r.relationship_type || undefined,
        icon: 'people',
      })
    }
    if (members.length > 1) {
      rows.push({
        label: ACTIVITY_LABEL.access,
        title: `${members.length - 1} invited family ${members.length - 1 === 1 ? 'member' : 'members'}`,
        icon: 'lock',
      })
    }
    return rows.slice(0, 5)
  }, [profile, assets, members])

  return {
    loading, error, profile, assets, members, memberships, role,
    creatorId: profile?.creator?.id || creatorIdParam,
    creatorName,
    portraitUrl: assets?.urls?.portrait || assets?.previewUrl || null,
    level, setupPct, counts, activity,
    locked: Boolean(profile?.locked),
    reload,
  }
}

export function ArchiveProvider({
  value, children,
}: { value: ArchiveContext; children: ReactNode }) {
  return createElement(ArchiveDataContext.Provider, { value }, children)
}

/** Shared archive data for every sidebar section. Do not refetch on each click. */
export function useArchiveContext(): ArchiveContext {
  const ctx = useContext(ArchiveDataContext)
  if (!ctx) throw new Error('useArchiveContext must be used inside ArchiveProvider')
  return ctx
}
