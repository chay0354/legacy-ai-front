import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { billingApi, type BillingPlan, type BillingPlanId, type BillingStatus } from '../lib/api'
import { T, sans } from '../design/tokens'
import { Body, Btn, Display, Eyebrow } from '../design/ui'

export default function PaywallCard({
  kind = 'interview',
  title = 'Choose a plan to continue',
  note = 'Everyone starts with the $699 package. After that you choose Monthly to keep interviewing, or Storage to keep the archive open.',
}: {
  kind?: 'interview' | 'unlock' | 'minutes'
  title?: string
  note?: string
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [billing, setBilling] = useState<BillingStatus | null>(null)

  useEffect(() => {
    let active = true
    billingApi.plans()
      .then((r) => { if (active) setPlans(r.plans || []) })
      .catch(() => { /* names alone are enough to continue */ })
    billingApi.status()
      .then((b) => { if (active) setBilling(b) })
      .catch(() => { /* unsigned visitors stay on the catalog copy */ })
    return () => { active = false }
  }, [])

  const ids: BillingPlanId[] = (() => {
    if (kind === 'minutes') return ['addon']
    if (kind === 'unlock') return ['monthly', 'storage']
    if (billing?.hasSetup) return ['monthly']
    return ['setup']
  })()

  const label = (id: BillingPlanId) => {
    const p = plans.find((x) => x.id === id)
    if (p) return `${p.name} — ${p.displayPrice}`
    if (id === 'storage') return 'Storage — $6.99'
    if (id === 'monthly') return 'Monthly — $69.90'
    if (id === 'setup') return 'Package — $699'
    if (id === 'addon') return 'Add 30 minutes — $29.99'
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
        onClick={() => navigate(kind === 'minutes' ? '/billing' : kind === 'unlock' ? '/billing' : '/pricing')}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
          fontFamily: sans, fontSize: 13.5, color: T.ink3, textDecoration: 'underline',
        }}
      >
        {kind === 'minutes' ? 'Back to billing' : 'Compare plans'}
      </button>
      {error && <Body size={13.5} color="#b04a3a">{error}</Body>}
    </div>
  )
}
