import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { requestPasswordReset, signInWithPassword, signUpWithPassword } from '../lib/auth'
import { BRAND, CTA, HERO } from '../design/copy'
import { billingApi, type BillingPlan } from '../lib/api'
import logo from '../assets/homepage/logo-cream.svg'
import photo from '../assets/editorial/p01.webp'
import './HomePage.css'
import './AuthPage.css'

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
      const redirectTo = `${window.location.origin}/reset-password`
      await requestPasswordReset(email.trim(), redirectTo)
      setNotice(`Reset link sent to ${email.trim()}. Open the email and choose a new password.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a reset email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="as-told-home auth-page">
      <a className="skip" href="#auth-form">Skip to sign in</a>
      <header className="site-header-surface auth-header">
        <Link to="/" aria-label={`${BRAND} home`}><img src={logo} width="78" height="66" alt={BRAND} /></Link>
        <p className="eyebrow">Private family archive</p>
      </header>
      <main className="auth-layout">
        <section className="auth-atmosphere" aria-label="Your private archive">
          <img className="auth-photo" src={photo} width="1536" height="768" alt="Illustrative parent and adult child sharing family photographs at a kitchen table." fetchPriority="high" />
          <div className="auth-story">
            <h2>{HERO.headline[0]}<br /><em>{HERO.headline[1]}</em></h2>
            <p>{HERO.sub}</p>
            <p className="auth-privacy">Private by default. Shared only with the people you choose.</p>
          </div>
        </section>
        <section className="auth-form-panel" id="auth-form" tabIndex={-1} aria-labelledby="auth-title">
          <div className="auth-form-content">
            <div className="auth-intro">
              <p className="eyebrow">{mode === 'signup' ? 'Begin your archive' : 'Welcome back'}</p>
              <h1 id="auth-title">{mode === 'signup' ? 'Create your account' : 'Sign in to your archive'}</h1>
              <p>{mode === 'signup'
                ? 'Your account holds your archive. You choose who is ever invited into it.'
                : 'Your archive is where you left it.'}</p>
            </div>
            {chosenPlan && (
              <div className="auth-plan">
                <p className="eyebrow">Next step</p>
                <p>{plan
                  ? `${plan.name} — ${plan.displayPrice} ${plan.cadence}.`
                  : chosenPlan === 'setup' ? 'Package — $699.'
                    : chosenPlan === 'monthly' ? 'Monthly — $69.90.'
                      : chosenPlan === 'storage' ? 'Storage — $6.99.'
                        : 'Your plan.'}
                  {' '}Payment comes after your account, on Stripe’s secure page.
                </p>
              </div>
            )}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <form onSubmit={submit}>
              {mode === 'signup' && (
                <label>Your name
                  <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
              )}
              <label>Email
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>Password
                <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} minLength={6} required onChange={(e) => setPassword(e.target.value)} />
              </label>
              <button className="primary auth-submit" type="submit" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'signup' ? CTA.begin : CTA.signIn}
              </button>
            </form>
            <div className="auth-options">
              <button type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null) }}>
                {mode === 'signup' ? 'I already have an account' : 'Create an account'}
              </button>
              <button type="button" onClick={forgot} disabled={busy}>Forgot password?</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
