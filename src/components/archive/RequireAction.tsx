import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useArchiveContext } from './data'
import { can, type Action } from '../../lib/permissions'

/** Send viewers away from screens they are not allowed to use. */
export default function RequireAction({
  action, children,
}: { action: Action | Action[]; children: ReactNode }) {
  const ctx = useArchiveContext()
  if (!ctx.profile) return null
  const need = Array.isArray(action) ? action : [action]
  const allowed = need.some((a) => can(ctx.role, a))
  if (!allowed) {
    const c = ctx.creatorId ? `?c=${ctx.creatorId}` : ''
    return <Navigate to={`/overview${c}`} replace />
  }
  return <>{children}</>
}
