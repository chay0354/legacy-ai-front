const RECOVERY_KEY = 'legacy.passwordRecovery'

/** Remember a recovery link before the auth client clears the URL hash. */
export function captureRecoveryFromUrl() {
  if (typeof window === 'undefined') return
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  if (hash.get('type') === 'recovery' || query.get('type') === 'recovery') {
    sessionStorage.setItem(RECOVERY_KEY, '1')
  }
}

export function markPasswordRecovery() {
  sessionStorage.setItem(RECOVERY_KEY, '1')
}

export function isPasswordRecovery() {
  return sessionStorage.getItem(RECOVERY_KEY) === '1'
}

export function clearPasswordRecovery() {
  sessionStorage.removeItem(RECOVERY_KEY)
}
