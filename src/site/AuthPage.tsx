import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { requestPasswordReset, signInWithPassword, signUpWithPassword } from '../lib/auth'
import { T, radius, sans, serif } from '../design/tokens'
import { BRAND, BRAND_SUB, CTA, HERO } from '../design/copy'
import { Body, Btn, Display, Eyebrow, Icon } from '../design/ui'
import { billingApi, type BillingPlan } from '../lib/api'

const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: T.card,
  border: `1px solid ${T.line}`, borderRadius: radius.sm, padding: '12px 14px',
  fontFamily: sans, fontSize: 15, color: T.ink, outline: 'none',
}

export default function AuthPage() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'signup' | 'signin'>(params.get('new') === '1' ? 'signup' : 'signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [plan, setPlan] = useState<BillingPlan | null>(null)

  // Someone who picked a plan on /pricing arrives here first — name it so the step makes sense.
  const chosenPlan = /checkout=(setup|monthly|storage|preserve|archive|family)/.exec(params.get('next') || '')?.[1] || null
  useEffect(() => {
    if (!chosenPlan) return
    let active = true
    billingApi.plans()
      .then((r) => {
        if (active) setPlan(r.plans?.find((p) => p.id === chosenPlan) || null)
      })
      .catch(() => { /* the step still works without the price */ })
    return () => { active = false }
  }, [chosenPlan])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signup') {
        const res = await signUpWithPassword(name, email.trim(), password)
        if (res.needsEmailConfirmation) {
          setNotice('Account created. Confirm your email, then sign in here.')
          setMode('signin')
        }
      } else {
        await signInWithPassword(email.trim(), password)
      }
      // App routes onward once the session lands.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg.toLowerCase().includes('already exists')) {
        setMode('signin')
        setNotice('You already have an account with this email. Enter your password to sign in.')
      } else if (/wrong email|invalid/i.test(msg)) {
        setError('That email and password do not match. Use “Forgot password?” if you need to reset it.')
      } else {
        setError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const forgot = async () => {
    if (!email.trim()) {
      setError('Enter your email above, then choose forgot password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = params.get('next')
      const redirectTo = next
        ? `${window.location.origin}/signin?next=${encodeURIComponent(next)}`
        : `${window.location.origin}/signin`
      await requestPasswordReset(email.trim(), redirectTo)
      setNotice(`Reset link sent to ${email.trim()}. Check your inbox, then sign in here.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a reset email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-split" style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(380px,.95fr)' }}>
      {/* atmosphere */}
      <section style={{ position: 'relative', background: T.walnutDeep, overflow: 'hidden' }}>
        {/* Photograph to place — a hallway of framed family photos. See HANDOFF.md. */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(110% 80% at 78% 28%, rgba(176,94,55,.26) 0%, rgba(24,18,13,0) 70%),
            linear-gradient(120deg, #17110c 8%, #241a13 58%, #33251b 100%)`,
        }} />
        <div style={{
          position: 'relative', height: '100%', padding: '34px 44px 48px',
          display: 'flex', flexDirection: 'column',
        }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontFamily: serif, fontSize: 22, color: T.onDark }}>{BRAND}</div>
            <div style={{ marginTop: 4 }}><Eyebrow color="rgba(179,144,47,.85)">{BRAND_SUB}</Eyebrow></div>
          </Link>
          <div style={{ marginTop: 'auto', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h1 style={{
              fontFamily: serif, fontWeight: 400, fontSize: 44, lineHeight: 1.08,
              color: T.onDark, margin: 0, letterSpacing: '-.015em',
            }}>
              {HERO.headline[0]}<br />
              <em style={{ fontStyle: 'italic' }}>{HERO.headline[1]}</em>
            </h1>
            <Body size={16} color="rgba(240,231,214,.78)">{HERO.sub}</Body>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 6,
              fontFamily: sans, fontSize: 13.5, color: 'rgba(240,231,214,.55)',
            }}>
              <Icon name="lock" size={15} color="rgba(240,231,214,.5)" strokeWidth={1.3} />
              Private by default. Shared only with the people you choose.
            </span>
          </div>
        </div>
      </section>

      {/* paper form */}
      <section style={{
        background: T.paper, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 44px',
      }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Eyebrow>{mode === 'signup' ? 'Begin your archive' : 'Welcome back'}</Eyebrow>
            <Display size={30}>
              {mode === 'signup' ? 'Create your account' : 'Sign in to your archive'}
            </Display>
            <Body size={14.5}>
              {mode === 'signup'
                ? 'Your account holds your archive. You choose who is ever invited into it.'
                : 'Your archive is where you left it.'}
            </Body>
          </div>

          {chosenPlan && (
            <div style={{
              border: `1px solid ${T.line}`, borderRadius: radius.sm, background: T.card,
              padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <Eyebrow>Next step</Eyebrow>
              <Body size={14}>
                {plan
                  ? `${plan.name} — ${plan.displayPrice} ${plan.cadence}.`
                  : chosenPlan === 'setup' ? 'Package — $699.'
                    : chosenPlan === 'monthly' ? 'Monthly — $69.90.'
                      : chosenPlan === 'storage' ? 'Storage — $6.99.'
                        : 'Your plan.'}
                {' '}Payment comes after your account, on Stripe’s secure page.
              </Body>
            </div>
          )}

          {notice && <Body size={13.5} color={T.olive}>{notice}</Body>}
          {error && <Body size={13.5} color={T.siennaDeep}>{error}</Body>}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'signup' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Eyebrow>Your name</Eyebrow>
                <input value={name} onChange={(e) => setName(e.target.value)} required style={input} />
              </label>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Eyebrow>Email</Eyebrow>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={input} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Eyebrow>Password</Eyebrow>
              <input
                type="password" value={password} minLength={6} required
                onChange={(e) => setPassword(e.target.value)} style={input}
              />
            </label>
            <div style={{ marginTop: 6 }}>
              <Btn type="submit" size="lg" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
                {busy ? 'Please wait…' : mode === 'signup' ? CTA.begin : CTA.signIn}
              </Btn>
            </div>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null) }}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: sans, fontSize: 13.5, fontWeight: 600, color: T.sienna,
              }}
            >
              {mode === 'signup' ? 'I already have an account' : 'Create an account'}
            </button>
            <button
              type="button" onClick={forgot} disabled={busy}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: sans, fontSize: 13.5, color: T.ink3,
              }}
            >
              Forgot password?
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
