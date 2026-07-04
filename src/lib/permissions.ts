/**
 * Legacy AI — Roles & Permissions (SINGLE SOURCE OF TRUTH)
 * ========================================================
 * Every role check in the app must come from THIS file. Do not scatter
 * `if (role === "admin")` / `role == 'creator'` strings around the codebase.
 * Import `can`, `ROLES`, and `ACTIONS` instead.
 *
 * Ported from docs/cursor-roles/permissions.js (the canonical task package).
 *
 * Three roles only:
 *   creator        — the person whose legacy is preserved. Full control of THEIR content.
 *   administrator  — a trusted family member. Manages access; cannot touch the creator's content.
 *   member         — an invited family member. Can visit, talk, and read only.
 */

export const ROLES = {
  CREATOR: 'creator',
  ADMINISTRATOR: 'administrator',
  MEMBER: 'member',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LIST: Role[] = [ROLES.CREATOR, ROLES.ADMINISTRATOR, ROLES.MEMBER];

export const ROLE_META: Record<Role, { label: string; accent: string }> = {
  [ROLES.CREATOR]: { label: 'Creator', accent: '#c06a44' },
  [ROLES.ADMINISTRATOR]: { label: 'Administrator', accent: '#71805c' },
  [ROLES.MEMBER]: { label: 'Member', accent: '#b3902f' },
};

/** Every gated action in the product. Reference these constants — never raw strings. */
export const ACTIONS = {
  // content (creator-owned)
  VIEW_CONTENT: 'view_content',
  ADD_MEMORY: 'add_memory',
  EDIT_MEMORY: 'edit_memory',
  DELETE_MEMORY: 'delete_memory',
  UPLOAD_MEDIA: 'upload_media',
  RECORD_VOICE: 'record_voice',
  COMPLETE_INTERVIEW: 'complete_interview',
  EDIT_PROFILE: 'edit_profile',
  // avatar
  CHAT_WITH_AVATAR: 'chat_with_avatar',
  // people & access
  INVITE_USER: 'invite_user',
  MANAGE_ACCESS: 'manage_access',
  APPOINT_ADMIN: 'appoint_admin',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

const MEMBER_ACTIONS: Action[] = [ACTIONS.VIEW_CONTENT, ACTIONS.CHAT_WITH_AVATAR];

const ADMIN_ACTIONS: Action[] = [...MEMBER_ACTIONS, ACTIONS.INVITE_USER, ACTIONS.MANAGE_ACCESS];

const CREATOR_ACTIONS: Action[] = [
  ...ADMIN_ACTIONS,
  ACTIONS.ADD_MEMORY,
  ACTIONS.EDIT_MEMORY,
  ACTIONS.DELETE_MEMORY,
  ACTIONS.UPLOAD_MEDIA,
  ACTIONS.RECORD_VOICE,
  ACTIONS.COMPLETE_INTERVIEW,
  ACTIONS.EDIT_PROFILE,
  ACTIONS.APPOINT_ADMIN,
];

const MATRIX: Record<Role, Set<Action>> = {
  [ROLES.MEMBER]: new Set(MEMBER_ACTIONS),
  [ROLES.ADMINISTRATOR]: new Set(ADMIN_ACTIONS),
  [ROLES.CREATOR]: new Set(CREATOR_ACTIONS),
};

/** can(role, action) -> boolean. Unknown role/action => false (deny by default). */
export function can(role: Role | string | null | undefined, action: Action): boolean {
  const set = MATRIX[role as Role];
  return set ? set.has(action) : false;
}

/** Normalize messy inputs ("Admin", "ADMINISTRATOR", legacy "owner") to a canonical role. */
export function normalizeRole(input: string | null | undefined): Role | null {
  if (!input) return null;
  const r = String(input).trim().toLowerCase();
  if (r === 'creator' || r === 'owner' || r === 'subject') return ROLES.CREATOR;
  if (r === 'administrator' || r === 'admin' || r === 'manager') return ROLES.ADMINISTRATOR;
  if (r === 'member' || r === 'viewer' || r === 'guest' || r === 'family') return ROLES.MEMBER;
  return null;
}

export function isRole(role: unknown): role is Role {
  return ROLE_LIST.includes(role as Role);
}
