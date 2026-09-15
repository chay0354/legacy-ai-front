import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { billingApi, type BillingPlan } from '../lib/api'
import { T, sans } from '../design/tokens'
import { Body, Btn, Display, Eyebrow } from '../design/ui'

const FALLBACK_LABEL: Record<string, string> = {
  archive: 'The Archive',
  family: 'Family',
}

export default function PaywallCard({
  title = 'Choose a plan to continue',
  note = 'The interview, live avatar, and family invitations are part of a paid archive. Reading what you already recorded stays available if you stop later.',
}: {
  title?: string
  note?: string
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState<'archive' | 'family' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])

  useEffect(() => {
    let active = true
    billingApi.plans()
      .then((r) => { if (active) setPlans(r.plans || []) })
      .catch(() => { /* names alone are enough to continue */ })
    return () => { active = false }
  }, [])

  const label = (id: 'archive' | 'family') => {
    const p = plans.find((x) => x.id === id)
    if (!p) return FALLBACK_LABEL[id]
    return `${p.name} — ${p.displayPrice} / ${p.interval}`
  }

  const start = async (plan: 'archive' | 'family') => {
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
        <Btn disabled={Boolean(busy)} onClick={() => void start('archive')}>
          {busy === 'archive' ? 'Opening checkout…' : label('archive')}
        </Btn>
        <Btn tone="quiet" disabled={Boolean(busy)} onClick={() => void start('family')}>
          {busy === 'family' ? 'Opening checkout…' : label('family')}
        </Btn>
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
