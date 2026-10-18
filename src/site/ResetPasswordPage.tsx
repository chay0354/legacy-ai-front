import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { clearPasswordRecovery, isPasswordRecovery, markPasswordRecovery } from '../lib/recovery'
import { T, radius, sans, serif } from '../design/tokens'
import { BRAND, BRAND_SUB } from '../design/copy'
import { Body, Btn, Display, Eyebrow } from '../design/ui'

const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: T.card,
  border: `1px solid ${T.line}`, borderRadius: radius.sm, padding: '12px 14px',
  fontFamily: sans, fontSize: 15, color: T.ink, outline: 'none',
}

function linkError() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const description = hash.get('error_description') || query.get('error_description')
  if (hash.get('error') || query.get('error') || description) {
    return description?.replace(/\+/g, ' ') || 'This reset link is no longer valid.'
  }
  return null
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(isPasswordRecovery())
  const [expired, setExpired] = useState<string | null>(linkError())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && isPasswordRecovery())) {
        markPasswordRecovery()
        setReady(true)
        setExpired(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Use at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      clearPasswordRecovery()
      setDone(true)
      navigate('/signin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the new password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: T.paper, padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: serif, fontSize: 22, color: T.ink }}>{BRAND}</div>
          <Eyebrow>{BRAND_SUB}</Eyebrow>
        </Link>
        <Display size={30}>Choose a new password</Display>
        {done && <Body size={14.5}>Password saved. Opening your archive.</Body>}
        {!done && expired && !ready && (
          <>
            <Body size={14.5} color={T.siennaDeep}>{expired}</Body>
            <Link to="/signin" style={{ fontFamily: sans, fontSize: 14, color: T.sienna, fontWeight: 600 }}>
              Request a new reset link
            </Link>
          </>
        )}
        {!done && !expired && !ready && (
          <>
            <Body size={14.5}>Open the reset link from your email on this page, then choose a new password.</Body>
            <Link to="/signin" style={{ fontFamily: sans, fontSize: 14, color: T.sienna, fontWeight: 600 }}>
              Back to sign in
            </Link>
          </>
        )}
        {!done && ready && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Eyebrow>New password</Eyebrow>
              <input type="password" value={password} minLength={6} required onChange={(e) => setPassword(e.target.value)} style={input} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Eyebrow>Confirm password</Eyebrow>
              <input type="password" value={confirm} minLength={6} required onChange={(e) => setConfirm(e.target.value)} style={input} />
            </label>
            {error && <Body size={13.5} color={T.siennaDeep}>{error}</Body>}
            <Btn type="submit" size="lg" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? 'Saving…' : 'Save password'}
            </Btn>
          </form>
        )}
      </div>
    </div>
  )
}
