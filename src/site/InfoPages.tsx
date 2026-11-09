import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EditorialSitePage } from './EditorialSiteChrome'
import { CTA } from '../design/copy'
import './PricingPage.css'
import { billingApi, type BillingPlan, type BillingStatus } from '../lib/api'
import { supabase } from '../lib/supabase'

export { default as HowItWorksPage } from './HowItWorksPage'

export { TheArchivePage, AboutPage } from './EditorialInfoPages'

/* ────────────────────────────── Pricing ──────────────────────────── */
const FALLBACK_PLANS: BillingPlan[] = [
  {
    id: 'setup',
    name: 'Package',
    displayPrice: '$699',
    cadence: 'one time · everyone starts here',
    amount: 69900,
    currency: 'usd',
    interval: 'once',
    primary: true,
    step: 1,
    canViewArchive: true,
    lines: [
      'The starting package for every new archive',
      'Interview, archive, live avatar, and family access',
      '180 minutes included for the first three months',
    ],
  },
  {
    id: 'monthly',
    name: 'Monthly',
    displayPrice: '$69.90',
    cadence: 'per month · 60 minutes',
    amount: 6990,
    currency: 'usd',
    interval: 'month',
    primary: false,
    step: 2,
    canViewArchive: true,
    lines: [
      'Keep interviewing and talking with 60 minutes each month',
      'Full archive, live avatar, and family invitations',
      'Available after the $699 package',
    ],
  },
  {
    id: 'storage',
    name: 'Storage',
    displayPrice: '$6.99',
    cadence: 'per month · keep your data',
    amount: 699,
    currency: 'usd',
    interval: 'month',
    primary: false,
    step: 2,
    canViewArchive: true,
    canInterview: false,
    lines: [
      'Keep the account and stored memories active',
      'Read the archive — no new interview minutes',
      'Available after the $699 package',
    ],
  },
]

export function PricingPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [plans, setPlans] = useState<BillingPlan[]>(FALLBACK_PLANS)
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(false)
  // A ?checkout= arrival is already on its way to Stripe — keep the buttons quiet meanwhile.
  const [busy, setBusy] = useState<string | null>(() => {
    const p = params.get('checkout')
    return p && ['setup', 'monthly', 'storage'].includes(p) ? p : null
  })
  const [error, setError] = useState<string | null>(null)
  const autoStarted = useRef(false)

  useEffect(() => {
    let active = true
    billingApi.plans()
      .then((r) => { if (active && r.plans?.length) setPlans(r.plans) })
      .catch(() => { /* keep fallback copy */ })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      setSignedIn(Boolean(session))
      if (session) {
        const b = await billingApi.status().catch(() => null)
        if (!active) return
        setBilling(b)
      }
      setReady(true)
    })
    return () => { active = false }
  }, [])

  const startCheckout = async (plan: BillingPlan['id']) => {
    if (!signedIn) {
      navigate(`/signin?new=1&next=${encodeURIComponent(`/pricing?checkout=${plan}`)}`)
      return
    }
    if ((plan === 'monthly' || plan === 'storage') && !billing?.hasSetup) {
      return startCheckout('setup')
    }
    if (plan === 'setup' && billing?.hasSetup) {
      navigate('/billing')
      return
    }
    if (billing?.paid && billing.plan === plan && billing.canViewArchive) {
      navigate(billing.hasSetup ? '/billing' : '/overview')
      return
    }
    setBusy(plan)
    setError(null)
    try {
      const { url } = await billingApi.checkout(plan)
      if (!url) throw new Error('Checkout did not return a payment page')
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout')
      setBusy(null)
    }
  }

  /**
   * Sign-up sends the chosen plan back here as ?checkout=. Drop the parameter before
   * leaving for Stripe, so returning with the browser back button does not reopen it.
   */
  useEffect(() => {
    if (!ready || autoStarted.current) return
    const plan = params.get('checkout')
    if (!plan || !['setup', 'monthly', 'storage'].includes(plan)) return
    autoStarted.current = true
    const rest = new URLSearchParams(params)
    rest.delete('checkout')
    setParams(rest, { replace: true })
    void startCheckout(plan as BillingPlan['id'])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn])

  const ctaFor = (p: BillingPlan) => {
    if (billing?.paid && billing.plan === p.id) return 'Current plan'
    if (p.id === 'setup' && billing?.hasSetup) return 'Package already paid'
    if ((p.id === 'monthly' || p.id === 'storage') && !billing?.hasSetup) {
      return signedIn ? 'Start with the package' : CTA.begin
    }
    if (busy === p.id) return 'Opening checkout…'
    return signedIn ? `Continue with ${p.name}` : CTA.begin
  }

  const hasSetup = Boolean(billing?.hasSetup)
  const visible = plans.filter((p) => p.id !== 'addon' && p.kind !== 'addon' && p.id !== 'preserve')
  const entry = visible.find((p) => p.id === 'setup') || visible.find((p) => p.step === 1)
  const next = hasSetup
    ? visible.filter((p) => p.id === 'monthly' || p.id === 'storage' || p.step === 2)
    : []

  const renderCard = (p: BillingPlan) => (
    <article className="pricing-plan" key={p.id}>
      <h2 className="eyebrow">{p.id === 'setup' ? 'The package' : p.name}</h2>
      <div className="pricing-price">{p.displayPrice}</div>
      <p className="pricing-cadence">{p.cadence}</p>
      <ul className="pricing-inclusions">{p.lines.map(line => <li key={line}>{line}</li>)}</ul>
      <button className="primary pricing-action" type="button"
        disabled={Boolean(busy) || Boolean(billing?.paid && billing.plan === p.id) || Boolean(p.id === 'setup' && billing?.hasSetup)}
        onClick={() => void startCheckout(p.id)}>{ctaFor(p)}</button>
    </article>
  )

  return (
    <EditorialSitePage>
      <div className={`editorial-wrap pricing-page${hasSetup ? ' pricing-continuation' : ''}`}>
        <header className="pricing-intro editorial-intro-copy">
          <p className="eyebrow">Pricing</p>
          <h1>{hasSetup ? 'The package is paid. Choose how to continue.' : 'Start with the package.'}</h1>
          <p className="editorial-lead">{hasSetup
            ? 'Keep interviewing with Monthly, or keep the stored archive open with Storage.'
            : 'Pay $699 once. That opens the interview, the archive, the live avatar, and family access — with 180 minutes for the first three months.'}</p>
        </header>
        <div className="pricing-options">
          {error && <p className="pricing-notice pricing-error" role="alert">{error}</p>}
          {ready && signedIn && billing?.hasSetup && (
            <div className="pricing-notice"><p className="eyebrow">Your package is paid</p><p>Choose Monthly to keep interview minutes, or Storage to keep the archive open.
              Extra minutes live on your billing page.</p></div>
          )}
          {ready && signedIn && !billing?.hasSetup && (
            <div className="pricing-notice"><p className="eyebrow">Your account is ready</p><p>The first choice is the package. How you continue comes later, after these three months.</p></div>
          )}
          {entry && !hasSetup && renderCard(entry)}
          {hasSetup && next.length > 0 && <div className="pricing-plan-grid">{next.map(renderCard)}</div>}
          {!hasSetup && <p className="pricing-aftercare">After the first three months you choose whether to keep interviewing or only keep
            the archive. Invited family never pays separately. Nothing is deleted without you.</p>}
          {hasSetup && <p className="pricing-aftercare">Extra interview minutes appear on your billing page when Monthly is active, or when
            those minutes run out. Storage does not include interview time.</p>}
        </div>
      </div>
    </EditorialSitePage>
  )
}
