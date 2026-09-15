import { apiUrl } from './apiUrl'
import type { BillingStatus } from './api'

const TOKEN_KEY = 'legacy-ai:admin-token'
const EMAIL_KEY = 'legacy-ai:admin-email'

export function adminToken() {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(TOKEN_KEY)
}

export function adminEmail() {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(EMAIL_KEY)
}

export function setAdminSession(token: string, email: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(EMAIL_KEY, email)
}

export function clearAdminSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(EMAIL_KEY)
}

export interface AdminOverview {
  users: number
  paid: number
  unpaid: number
  credited: number
  archives: number
  pendingInvitations: number
  stripe: boolean
  dbMode: string
}

export interface AdminCredit {
  at: string
  months: number
  plan: string
  notes?: string
}

export interface AdminBilling extends BillingStatus {
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  source?: string | null
  notes?: string | null
  credits?: AdminCredit[]
}

export interface AdminUserRow {
  id: string
  email: string | null
  name: string | null
  createdAt?: string
  lastSignInAt?: string | null
  emailConfirmed: boolean
  banned?: boolean
  billing: AdminBilling
  archiveCount: number
  archives: { id: string; displayName: string | null; avatarLevel: number; completionScore: number }[]
}

export interface AdminArchive {
  id: string
  user_id: string
  display_name: string | null
  avatar_level: number
  completion_score: number
  gender?: string | null
  pronouns?: string | null
  memoryCount: number
  members: { id?: string; user_id: string; role: string; created_at?: string }[]
  invitations: {
    id: string
    email?: string | null
    role: string
    status: string
    token?: string
    expires_at?: string
  }[]
}

export interface AdminUserDetail {
  user: AdminUserRow
  billing: AdminBilling
  archives: AdminArchive[]
  memberships: { creator_id: string; user_id: string; role: string }[]
}

async function adminFetch(path: string, options: RequestInit = {}) {
  const token = adminToken()
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `Admin API ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data
}

export const adminApi = {
  configured: () =>
    fetch(apiUrl('/api/admin/configured')).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      return data as { configured: boolean }
    }),

  login: (email: string, password: string) =>
    fetch(apiUrl('/api/admin/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Wrong email or password')
      return data as { token: string; email: string; expiresInHours: number }
    }),

  overview: () => adminFetch('/api/admin/overview') as Promise<AdminOverview>,

  users: (q?: string) =>
    adminFetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`) as Promise<{ users: AdminUserRow[] }>,

  user: (id: string) => adminFetch(`/api/admin/users/${id}`) as Promise<AdminUserDetail>,

  setPlan: (id: string, plan: 'archive' | 'family' | 'none', opts?: { lifetime?: boolean; notes?: string }) =>
    adminFetch(`/api/admin/users/${id}/plan`, {
      method: 'POST',
      body: JSON.stringify({ plan, ...opts }),
    }) as Promise<AdminBilling>,

  credit: (id: string, months: number, plan: 'archive' | 'family', notes?: string) =>
    adminFetch(`/api/admin/users/${id}/credit`, {
      method: 'POST',
      body: JSON.stringify({ months, plan, notes }),
    }) as Promise<{ billing: AdminBilling; credit: AdminCredit }>,

  revoke: (id: string, notes?: string) =>
    adminFetch(`/api/admin/users/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }) as Promise<AdminBilling>,

  confirmEmail: (id: string) =>
    adminFetch(`/api/admin/users/${id}/confirm-email`, { method: 'POST' }) as Promise<{ ok: boolean }>,

  deleteUser: (id: string) =>
    adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>,

  updateArchive: (id: string, patch: { displayName?: string; avatarLevel?: number; completionScore?: number }) =>
    adminFetch(`/api/admin/archives/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }) as Promise<{ archive: AdminArchive }>,

  deleteArchive: (id: string) =>
    adminFetch(`/api/admin/archives/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>,

  setMemberRole: (userId: string, creatorId: string, role: string) =>
    adminFetch(`/api/admin/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ creatorId, role }),
    }),

  removeMember: (userId: string, creatorId: string) =>
    adminFetch(`/api/admin/members/${userId}?creatorId=${encodeURIComponent(creatorId)}`, { method: 'DELETE' }),

  revokeInvitation: (id: string) =>
    adminFetch(`/api/admin/invitations/${id}`, { method: 'DELETE' }),
}
