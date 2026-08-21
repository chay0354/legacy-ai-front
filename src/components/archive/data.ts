import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  accessApi, avatarApi, interviewApi,
  type AvatarAssetsResponse, type MemberRow, type Role,
} from '../../lib/api'
import type { LegacyProfile } from '../../lib/mapAvatarData'
import { ACTIONS, can, normalizeRole } from '../../lib/permissions'
import { ACTIVITY_LABEL } from '../../design/copy'

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
  role: Role
  creatorId?: string
  creatorName: string
  portraitUrl: string | null
  level: number
  setupPct: number
  counts: ArchiveCounts
  activity: ArchiveActivity[]
  reload: () => void
}

/**
 * One loader for every archive section screen: profile, media assets and
 * (where permitted) the family roster.
 */
export function useArchiveContext(creatorIdParam?: string, opts?: { withMedia?: boolean }): ArchiveContext {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<(LegacyProfile & { role?: Role }) | null>(null)
  const [assets, setAssets] = useState<AvatarAssetsResponse | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])
  const withMedia = opts?.withMedia !== false

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([
      interviewApi.getProfile(creatorIdParam),
      avatarApi.getAssets({ creatorId: creatorIdParam, light: !withMedia }).catch(() => null),
    ])
      .then(([p, a]) => {
        if (!active) return
        setProfile(p)
        setAssets(a)
        const role = normalizeRole(p.role) || 'member'
        const cid = p.creator?.id || creatorIdParam
        if (cid && (can(role, ACTIONS.MANAGE_ACCESS) || can(role, ACTIONS.INVITE_USER))) {
          accessApi.members(cid)
            .then((m) => { if (active) setMembers(m.members) })
            .catch(() => { /* roster is optional */ })
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not open this archive')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [creatorIdParam, tick, withMedia])

  const role = (normalizeRole(profile?.role) || 'member') as Role
  const creatorName = profile?.creator?.display_name || 'Your'
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

  /** Labels must match the object — a photograph is never "People added". */
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
      rows.push({ label: ACTIVITY_LABEL.voice, title: 'Voice sample recorded', icon: 'voice' })
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
    loading, error, profile, assets, members, role,
    creatorId: profile?.creator?.id || creatorIdParam,
    creatorName,
    portraitUrl: assets?.urls?.portrait || assets?.previewUrl || null,
    level, setupPct, counts, activity, reload,
  }
}
