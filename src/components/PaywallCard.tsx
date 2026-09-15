import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { billingApi, type BillingPlan, type BillingPlanId } from '../lib/api'
import { T, sans } from '../design/tokens'
import { Body, Btn, Display, Eyebrow } from '../design/ui'

const INTERVIEW_PLANS: BillingPlanId[] = ['preserve', 'monthly', 'setup']
const UNLOCK_PLANS: BillingPlanId[] = ['monthly', 'setup']

export default function PaywallCard({
  kind = 'interview',
  title = 'Choose a plan to continue',
  note = 'Preserve lets you record the interview. Monthly or Set up opens the archive so you can see what was kept.',
}: {
  kind?: 'interview' | 'unlock'
  title?: string
  note?: string
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])

  useEffect(() => {
    let active = true
    billingApi.plans()
      .then((r) => { if (active) setPlans(r.plans || []) })
      .catch(() => { /* names alone are enough to continue */ })
    return () => { active = false }
  }, [])

  const ids = kind === 'unlock' ? UNLOCK_PLANS : INTERVIEW_PLANS

  const label = (id: BillingPlanId) => {
    const p = plans.find((x) => x.id === id)
    if (p) return `${p.name} — ${p.displayPrice}`
    if (id === 'preserve') return 'Preserve — $6.99'
    if (id === 'monthly') return 'Monthly — $69.90'
    if (id === 'setup') return 'Set up — $699'
    return id
  }

  const start = async (plan: BillingPlanId) => {
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

  return (
    <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Eyebrow>Pricing</Eyebrow>
      <Display size={30}>{title}</Display>
      <Body size={15}>{note}</Body>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {ids.map((id, i) => (
          <Btn
            key={id}
            tone={i === 0 ? 'primary' : 'quiet'}
            disabled={Boolean(busy)}
            onClick={() => void start(id)}
          >
            {busy === id ? 'Opening checkout…' : label(id)}
          </Btn>
        ))}
      </div>
      <button
        type="button"
        onClick={() => navigate('/pricing')}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
          fontFamily: sans, fontSize: 13.5, color: T.ink3, textDecoration: 'underline',
        }}
      >
        Compare plans
      </button>
      {error && <Body size={13.5} color="#b04a3a">{error}</Body>}
    </div>
  )
}
