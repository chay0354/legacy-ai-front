import { adminToken } from './adminApi'

/** Staff are editing the site in this tab, on top of the real pages. */
export function editingSite() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('edit') === '1' && Boolean(adminToken())
}

/** Keep edit mode on archive links, and do not attach a real archive id. */
export function archiveQuery(creatorId?: string) {
  if (editingSite()) return '?edit=1'
  return creatorId ? `?c=${encodeURIComponent(creatorId)}` : ''
}
