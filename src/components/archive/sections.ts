import { ACTIONS, can, normalizeRole } from '../../lib/permissions'
import type { Role } from '../../lib/api'
import { NAV } from '../../design/copy'
import type { IconName } from '../../design/ui'

/**
 * The archive is ONE main screen. Every section below is a band on that screen;
 * the side navigation scrolls to it rather than routing away.
 *
 * Visibility is decided here and nowhere else, from the canonical permission
 * matrix in lib/permissions.ts:
 *
 *   creator        the archive owner. Sees everything, plus Interview and Edit archive.
 *   administrator  a trusted family member. Sees the whole archive and manages access.
 *                  No interview, no editing of the owner's entries.
 *   member         an invited family member. Reads and listens. No access controls,
 *                  no editing, no interview.
 */

export type SectionKey =
  | 'setup' | 'stories' | 'voice' | 'photos' | 'people' | 'wisdom' | 'access' | 'ask'

export interface SectionDef {
  key: SectionKey
  label: string
  icon: IconName
  /** Shown in the side navigation. */
  inNav: boolean
}

const ALL: SectionDef[] = [
  { key: 'setup', label: 'Archive setup', icon: 'overview', inNav: true },
  { key: 'stories', label: NAV.stories, icon: 'story', inNav: true },
  { key: 'voice', label: NAV.voice, icon: 'voice', inNav: true },
  { key: 'photos', label: NAV.photos, icon: 'photo', inNav: true },
  { key: 'people', label: NAV.people, icon: 'people', inNav: true },
  { key: 'wisdom', label: 'What you were told', icon: 'document', inNav: true },
  { key: 'ask', label: 'Ask the archive', icon: 'ask', inNav: true },
  { key: 'access', label: NAV.access, icon: 'lock', inNav: true },
]

/** Which sections of the main screen this role may see. */
export function sectionsForRole(role: Role | string | null | undefined): SectionDef[] {
  const r = normalizeRole(role) || 'member'
  return ALL.filter((s) => {
    switch (s.key) {
      // Setup progress is about the owner's work — administrators track it, members do not.
      case 'setup':
        return r === 'creator' || r === 'administrator'
      // Access controls belong to whoever can manage them.
      case 'access':
        return can(r, ACTIONS.MANAGE_ACCESS) || can(r, ACTIONS.INVITE_USER)
      case 'ask':
        return can(r, ACTIONS.CHAT_WITH_AVATAR)
      default:
        return can(r, ACTIONS.VIEW_CONTENT)
    }
  })
}

export const isOwner = (role: Role | string | null | undefined) => normalizeRole(role) === 'creator'

/** Only the archive owner reaches the edit surface (entries, media, live avatar). */
export const canEditArchive = (role: Role | string | null | undefined) =>
  can(role, ACTIONS.EDIT_MEMORY)

export const canRunInterview = (role: Role | string | null | undefined) =>
  can(role, ACTIONS.COMPLETE_INTERVIEW)

export const canSetUpLiveAvatar = (role: Role | string | null | undefined) =>
  can(role, ACTIONS.EDIT_PROFILE)

export const canManageAccess = (role: Role | string | null | undefined) =>
  can(role, ACTIONS.MANAGE_ACCESS) || can(role, ACTIONS.INVITE_USER)

export const canAsk = (role: Role | string | null | undefined) =>
  can(role, ACTIONS.CHAT_WITH_AVATAR)

/** One line explaining, to this viewer, what they are looking at. */
export function roleStandfirst(role: Role | string | null | undefined, ownerFirstName: string) {
  const r = normalizeRole(role) || 'member'
  if (r === 'creator') return 'Your archive is taking shape, one story at a time.'
  if (r === 'administrator') {
    return `You help look after ${ownerFirstName}’s archive. You can manage who has access, not what is in it.`
  }
  return `${ownerFirstName} shared this archive with you. Everything here is in their own words.`
}
