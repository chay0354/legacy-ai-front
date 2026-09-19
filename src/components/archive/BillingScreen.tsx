import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { billingApi, type BillingInvoice, type BillingPlan, type BillingStatus } from '../../lib/api'
import { T, sans } from '../../design/tokens'
import { Body, Btn, Display, Panel } from '../../design/ui'
import { SectionHeader } from './parts'

function planName(plan?: string | null) {
  if (plan === 'setup') return 'Package'
  if (plan === 'monthly') return 'Monthly'
  if (plan === 'storage') return 'Storage'
  if (plan === 'preserve') return 'Preserve'
  if (plan === 'family') return 'Family'
  if (plan === 'archive') return 'The Archive'
  return 'No plan'
}

function money(cents: number, currency = 'usd') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}

function dateLabel(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusLine(billing: BillingStatus | null) {
  if (!billing) return 'Checking your plan…'
  if (billing.paid) {
    const end = dateLabel(billing.currentPeriodEnd)
    const period = billing.cancelAtPeriodEnd
      ? end ? `Ending ${end}` : 'Ending after this period'
      : end ? `Active through ${end}` : 'Active'
    const minutes = billing.usesMinutes
      ? (billing.minutesRemaining ?? 0) > 0
        ? `${billing.minutesRemaining} minutes left`
        : 'No interview minutes left'
      : billing.plan === 'storage'
        ? 'Storage only — archive stays open'
        : null
    return [planName(billing.plan), period, minutes].filter(Boolean).join(' · ')
  }
  if (billing.hasSetup) return 'The $699 package is already paid. Choose Monthly or Storage to keep the archive active.'
  return 'Start with the $699 package. After that you choose Monthly or Storage.'
}

export default function BillingScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const choose = params.get('choose') === '1'
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      billingApi.status().catch(() => null),
      billingApi.plans().catch(() => ({ plans: [] as BillingPlan[] })),
      billingApi.invoices().catch(() => ({ invoices: [] as BillingInvoice[] })),
    ]).then(([status, catalog, history]) => {
      if (!active) return
      setBilling(status)
      setPlans(catalog.plans || [])
      setInvoices(history.invoices || [])
      setLoaded(true)
    })
    return () => { active = false }
  }, [])

  const start = async (plan: BillingPlan['id']) => {
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

  const openPortal = async () => {
    setBusy('portal')
    setError(null)
    try {
      const { url } = await billingApi.portal()
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the billing portal')
      setBusy(null)
    }
  }

  const monthly = plans.find((p) => p.id === 'monthly')
  const storage = plans.find((p) => p.id === 'storage')
  const setup = plans.find((p) => p.id === 'setup')
  const complimentary = billing?.plan === 'archive' || billing?.plan === 'family' || billing?.source === 'comp'
  const showSetup = Boolean(billing?.needsSetup)
  const showMonthly = Boolean(billing?.hasSetup && billing.plan !== 'monthly' && !complimentary)
  const showStorage = Boolean(billing?.hasSetup && billing.plan !== 'storage' && !complimentary)
  const showContinuation = showMonthly || showStorage
  const continuationTitle = billing?.plan === 'monthly'
    ? 'Change plan'
    : billing?.plan === 'storage'
      ? 'Upgrade to Monthly'
      : 'Continue after the package'
  const continuationNote = billing?.plan === 'monthly'
    ? 'Switch to Storage when you are done interviewing. The archive stays open; interview minutes stop.'
    : billing?.plan === 'storage'
      ? 'Monthly adds 60 interview minutes each month so you can keep adding to the archive.'
      : 'Monthly keeps interview minutes. Storage keeps the stored archive active without new interviews.'

  return (
    <>
      <SectionHeader
        eyebrow="Upgrade"
        title="Plan and purchases"
        note={choose
          ? 'The package is paid. Choose Monthly to keep interviewing, or Storage to keep the archive open.'
          : 'Your current plan, remaining minutes, extra interview time, and past payments.'}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
        <Panel pad="22px 24px">
          <Display size={20} style={{ marginBottom: 8 }}>Current plan</Display>
          <Body size={15}>{loaded ? statusLine(billing) : 'Checking your plan…'}</Body>
          {billing?.notes && <Body size={13.5} color={T.ink3} style={{ marginTop: 8 }}>{billing.notes}</Body>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {billing?.paid && (
              <Btn tone="quiet" disabled={Boolean(busy)} onClick={() => void openPortal()}>
                {busy === 'portal' ? 'Opening…' : 'Manage payment method'}
              </Btn>
            )}
            {billing?.canInterview && (
              <Btn tone="quiet" onClick={() => navigate('/interview')}>Go to the interview</Btn>
            )}
            {billing?.canViewArchive && (
              <Btn tone="quiet" onClick={() => navigate('/overview')}>Open the archive</Btn>
            )}
            {showSetup && setup && (
              <Btn disabled={Boolean(busy)} onClick={() => void start('setup')}>
                {busy === 'setup' ? 'Opening checkout…' : `Start with the package — ${setup.displayPrice}`}
              </Btn>
            )}
          </div>
        </Panel>

        {showContinuation && (
          <Panel pad="22px 24px">
            <Display size={20} style={{ marginBottom: 8 }}>{continuationTitle}</Display>
            <Body size={14.5} style={{ marginBottom: 14 }}>{continuationNote}</Body>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {showMonthly && (
                <Btn disabled={Boolean(busy)} onClick={() => void start('monthly')}>
                  {busy === 'monthly'
                    ? 'Opening checkout…'
                    : `Monthly — ${monthly?.displayPrice || '$69.90'}/mo`}
                </Btn>
              )}
              {showStorage && (
                <Btn tone="quiet" disabled={Boolean(busy)} onClick={() => void start('storage')}>
                  {busy === 'storage'
                    ? 'Opening checkout…'
                    : `Storage — ${storage?.displayPrice || '$6.99'}/mo`}
                </Btn>
              )}
            </div>
          </Panel>
        )}

        {billing?.canBuyAddon && (
          <Panel pad="22px 24px">
            <Display size={20} style={{ marginBottom: 8 }}>Extra interview time</Display>
            <Body size={14.5}>
              {billing.minutesExhausted
                ? 'Your included minutes are used. Add 30 minutes to keep interviewing and calling.'
                : `${billing.minutesRemaining ?? 0} minutes remaining. You can add 30 more when you want them.`}
            </Body>
            <div style={{ marginTop: 14 }}>
              <Btn
                tone={billing.minutesExhausted ? 'primary' : 'quiet'}
                disabled={Boolean(busy)}
                onClick={() => void start('addon')}
              >
                {busy === 'addon'
                  ? 'Opening checkout…'
                  : `Add 30 minutes — ${billing.addon?.displayPrice || '$29.99'}`}
              </Btn>
            </div>
          </Panel>
        )}

        <Panel pad="22px 24px">
          <Display size={20} style={{ marginBottom: 8 }}>Payments and receipts</Display>
          {!loaded && <Body size={14.5}>Loading invoices…</Body>}
          {loaded && invoices.length === 0 && (
            <Body size={14.5} color={T.ink3}>No invoices yet. Paid checkouts and monthly renewals will appear here.</Body>
          )}
          {invoices.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                    padding: '10px 0', borderBottom: `1px solid ${T.line}`,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: sans, fontSize: 14.5, color: T.ink }}>
                      {dateLabel(inv.created) || 'Payment'}
                      {inv.number ? ` · ${inv.number}` : ''}
                    </span>
                    <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3 }}>
                      {inv.description || 'Invoice'} · {inv.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: sans, fontSize: 14.5, color: T.ink }}>
                      {money(inv.amountPaid || inv.amountDue, inv.currency)}
                    </span>
                    {(inv.hostedInvoiceUrl || inv.invoicePdf) && (
                      <a
                        href={inv.hostedInvoiceUrl || inv.invoicePdf || '#'}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontFamily: sans, fontSize: 13.5, color: T.sienna }}
                      >
                        View receipt
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {error && <Body size={14} color="#b04a3a">{error}</Body>}
      </div>
    </>
  )
}
