import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SitePage } from './SiteChrome'
import { T, radius, sans, serif } from '../design/tokens'
import { CTA, HOW_IT_WORKS, NAV, TRUST } from '../design/copy'
import { Body, Btn, Display, Divider, Eyebrow, Icon, ImageSlot, Panel } from '../design/ui'
import { billingApi, type BillingPlan, type BillingStatus } from '../lib/api'
import { supabase } from '../lib/supabase'

function PageHead({
  eyebrow, title, standfirst,
}: { eyebrow: string; title: string; standfirst?: string }) {
  return (
    <div className="site-page-head" style={{ background: T.walnut }}>
      <div className="site-page-head-inner" style={{ padding: '48px 44px 42px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Eyebrow color="rgba(179,144,47,.9)">{eyebrow}</Eyebrow>
          <Display size={46} color={T.onDark} style={{ fontSize: 'clamp(28px, 6vw, 46px)' }}>{title}</Display>
          {standfirst && <Body size={17.5} color={T.onDark2} style={{ maxWidth: 620 }}>{standfirst}</Body>}
        </div>
      </div>
    </div>
  )
}

const wrap: CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '0 44px 80px' }

const STEP_MEDIA: Record<number, { label: string; height: number }> = {
  0: { label: 'A table, a notebook, an afternoon', height: 140 },
  1: { label: 'Letters and old prints', height: 140 },
  3: { label: 'A hallway of framed photos', height: 140 },
}

/* ─────────────────────────── How it works ─────────────────────────── */
export function HowItWorksPage() {
  const navigate = useNavigate()
  return (
    <SitePage>
      <PageHead
        eyebrow="How it works"
        title="A guided conversation that becomes a private family archive."
        standfirst="Five steps, at your pace. You can stop after any one of them and pick it up months later."
      />
      <div className="site-wrap" style={wrap}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {HOW_IT_WORKS.map((s, i) => (
            <div key={s.n} className="how-step" style={{
              display: 'grid',
              gridTemplateColumns: STEP_MEDIA[i]
                ? '72px minmax(0,1fr) minmax(0,.8fr)'
                : '72px minmax(0,1fr)',
              gap: 30, padding: '30px 0',
              borderTop: `1px solid ${i === 0 ? T.line : T.lineSoft}`,
              alignItems: 'start',
            }}>
              <span className="how-step-num" style={{ fontFamily: serif, fontSize: 22, color: T.gold, letterSpacing: '.08em' }}>{s.n}</span>
              <div className="how-step-copy" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <Display size={26}>{s.title}</Display>
                <Body size={15.5} style={{ maxWidth: 520 }}>{s.body}</Body>
              </div>
              {STEP_MEDIA[i] && (
                <div className="how-step-media" style={{ paddingTop: 4 }}>
                  <ImageSlot label={STEP_MEDIA[i].label} height={STEP_MEDIA[i].height} />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="how-step-cta site-btn-row" style={{ marginTop: 40, display: 'flex', gap: 12, flexWrap: 'wrap', marginLeft: 102 }}>
          <Btn size="lg" onClick={() => navigate('/signin?new=1')}>{CTA.start}</Btn>
          <Btn size="lg" tone="quiet" onClick={() => navigate('/the-archive')}>See what an archive holds</Btn>
        </div>
      </div>
    </SitePage>
  )
}

/* ──────────────────────────── The Archive ─────────────────────────── */
const SECTIONS = [
  { icon: 'story' as const, label: NAV.stories, body: 'Entries gathered in conversation, each with a date, the people in it, and what you took from it.' },
  { icon: 'voice' as const, label: NAV.voice, body: 'Recordings kept as recordings. A story arrives the way you told it, in your voice.' },
  { icon: 'photo' as const, label: NAV.photos, body: 'Photographs, letters, and papers, sitting with the story they belong to.' },
  { icon: 'people' as const, label: NAV.people, body: 'The people who shaped the stories, and how you described them.' },
  { icon: 'lock' as const, label: NAV.access, body: 'Who can open the archive, what they can see, and your record of every change.' },
]

export function TheArchivePage() {
  const navigate = useNavigate()
  return (
    <SitePage>
      <PageHead
        eyebrow="The Archive"
        title="A private archive of the stories only you can tell."
        standfirst="Everything you record is organized into sections you can read, correct, and add to for as long as you like."
      />
      <div className="site-wrap" style={wrap}>
        <div className="archive-section-grid" style={{
          display: 'grid', gap: 16,
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}>
          {SECTIONS.map((s) => (
            <Panel key={s.label} pad="24px 26px" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Icon name={s.icon} size={20} color={T.gold} strokeWidth={1.4} />
              <Display size={21}>{s.label}</Display>
              <Body size={14.5}>{s.body}</Body>
            </Panel>
          ))}
        </div>

        <div className="archive-wont-card" style={{
          marginTop: 40, background: T.walnut, borderRadius: radius.md,
          padding: '40px 42px', display: 'grid', gap: 36,
          gridTemplateColumns: 'minmax(280px,1fr) minmax(260px,.85fr)', alignItems: 'center',
          boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Eyebrow color="rgba(179,144,47,.9)">What the archive will not do</Eyebrow>
            <Display size={28} color={T.onDark}>It answers only from what you shared.</Display>
            <Body size={15.5} color={T.onDark2} style={{ maxWidth: 460 }}>
              No invention, no filling in the gaps. If your family asks something the archive does
              not hold, it says so — and the question is kept, in case you want to answer it later.
            </Body>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TRUST.slice(0, 4).map((line) => (
              <span key={line} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                fontFamily: sans, fontSize: 15, color: T.onDark,
                lineHeight: 1.45, overflowWrap: 'anywhere',
              }}>
                <Icon name="check" size={16} color="rgba(179,144,47,.9)" strokeWidth={1.4} />
                {line}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 34 }}>
          <Btn size="lg" onClick={() => navigate('/signin?new=1')}>{CTA.build}</Btn>
        </div>
      </div>
    </SitePage>
  )
}

/* ────────────────────────────── Pricing ──────────────────────────── */
const FALLBACK_PLANS: BillingPlan[] = [
  {
    id: 'setup',
    name: 'Set up',
    displayPrice: '$699.00',
    cadence: 'one time · includes first 3 months',
    amount: 69900,
    currency: 'usd',
    interval: 'once',
    primary: false,
    canViewArchive: true,
    lines: [
      'Everything in Monthly, prepaid for three months',
      'Interview, archive, live avatar, and family access',
      '180 minutes included',
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
    primary: true,
    canViewArchive: true,
    lines: [
      'Guided interview and a full archive you can read',
      'Live avatar and family invitations',
      '60 minutes each month',
    ],
  },
  {
    id: 'preserve',
    name: 'Preserve',
    displayPrice: '$6.99',
    cadence: 'one time · interview only',
    amount: 699,
    currency: 'usd',
    interval: 'once',
    primary: false,
    canViewArchive: false,
    lines: [
      'Record the guided interview',
      'We keep what you share',
      'Pay Monthly or Set up when you want to see the archive',
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
    return p && ['setup', 'monthly', 'preserve', 'archive', 'family'].includes(p) ? p : null
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
    if (billing?.paid && billing.plan === plan && billing.canViewArchive) {
      navigate('/overview')
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
    if (!plan || !['setup', 'monthly', 'preserve', 'archive', 'family'].includes(plan)) return
    autoStarted.current = true
    const rest = new URLSearchParams(params)
    rest.delete('checkout')
    setParams(rest, { replace: true })
    void startCheckout(plan as BillingPlan['id'])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn])

  const ctaFor = (p: BillingPlan) => {
    if (billing?.paid && billing.plan === p.id) return 'Current plan'
    if (billing?.paid && !billing.canViewArchive && p.canViewArchive) return `Open the archive with ${p.name}`
    if (busy === p.id) return 'Opening checkout…'
    return signedIn ? `Continue with ${p.name}` : CTA.begin
  }

  return (
    <SitePage>
      <PageHead
        eyebrow="Pricing"
        title="Record now. Open the archive when you are ready."
        standfirst="Preserve is the interview only. Monthly and Set up open the stories, people, and live avatar."
      />
      <div className="site-wrap" style={wrap}>
        {error && (
          <div style={{
            maxWidth: 860, marginBottom: 22, padding: '14px 16px',
            border: `1px solid ${T.sienna}`, borderRadius: radius.sm, background: T.card,
          }}>
            <Body size={14.5} color="#b04a3a">{error}</Body>
          </div>
        )}
        {ready && signedIn && !billing?.paid && (
          <div style={{
            maxWidth: 860, marginBottom: 22, padding: '14px 16px',
            border: `1px solid ${T.line}`, borderRadius: radius.sm, background: T.card,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <Eyebrow>Your account is ready</Eyebrow>
            <Body size={14.5}>
              Choose Preserve to record the interview, or Monthly / Set up if you want to see the
              archive afterwards.
            </Body>
          </div>
        )}
        <div className="pricing-grid" style={{
          display: 'grid', gap: 18,
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', maxWidth: 860,
        }}>
          {plans.filter((p) => p.id !== 'addon' && p.kind !== 'addon').map((p) => (
            <Panel
              key={p.id}
              pad="30px 30px 32px"
              style={{
                display: 'flex', flexDirection: 'column', gap: 14,
                borderColor: p.primary ? 'rgba(176,94,55,.45)' : T.cardEdge,
              }}
            >
              <Eyebrow color={p.primary ? T.sienna : T.ink3}>{p.name}</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: serif, fontSize: 34, color: T.ink }}>{p.displayPrice}</span>
                <span style={{ fontFamily: sans, fontSize: 13.5, color: T.ink3 }}>{p.cadence}</span>
              </div>
              <Divider tone="gold" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.lines.map((l) => (
                  <span key={l} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    fontFamily: sans, fontSize: 14.5, color: T.ink2, lineHeight: 1.5,
                  }}>
                    <Icon name="check" size={15} color={T.olive} strokeWidth={1.4} style={{ marginTop: 3 }} />
                    {l}
                  </span>
                ))}
              </div>
              <div className="pricing-cta" style={{ marginTop: 'auto', paddingTop: 16 }}>
                <Btn
                  disabled={Boolean(busy) || Boolean(billing?.paid && billing.plan === p.id && billing.canViewArchive)}
                  onClick={() => void startCheckout(p.id)}
                >
                  {ctaFor(p)}
                </Btn>
              </div>
            </Panel>
          ))}
        </div>
        <Body size={14} color={T.ink3} style={{ marginTop: 26, maxWidth: 620 }}>
          Preserve keeps the recording closed until you pay Monthly or Set up. Extra minutes
          ($29.99 for 30) appear in Settings after you have an active Monthly or Set up plan,
          or when those minutes run out. Nothing is deleted without your instruction. Invited
          family never pays separately.
        </Body>
      </div>
    </SitePage>
  )
}

/* ─────────────────────────────── About ───────────────────────────── */
export function AboutPage() {
  const navigate = useNavigate()
  return (
    <SitePage>
      <PageHead
        eyebrow="About"
        title="Why this exists"
        standfirst="Most families discover what they wanted to ask a few years too late. This is a way to answer those questions while it is still easy to."
      />
      <div className="site-wrap" style={wrap}>
        <div className="about-split" style={{
          display: 'grid', gap: 40,
          gridTemplateColumns: 'minmax(320px, 1.15fr) minmax(260px, .8fr)', alignItems: 'start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 620 }}>
            <Body size={16.5}>
              The idea started with an ordinary problem: a family that knew the outline of a life but
              almost none of the detail. Where the stories came from, who was in them, what was
              learned. The facts were recoverable. The voice was not.
            </Body>
            <Body size={16.5}>
              So the product is built around a conversation rather than a form. The questions do the
              work of remembering, and what comes back is kept as you said it — text, voice,
              photographs, and the people attached to each story.
            </Body>
            <Body size={16.5}>
              It is private on purpose. An archive is only worth building if you can be honest in it,
              which means you decide who reads it and when.
            </Body>
            <div id="privacy" style={{ marginTop: 12 }}>
              <Eyebrow>Security & privacy</Eyebrow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {TRUST.map((line) => (
                  <span key={line} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    fontFamily: sans, fontSize: 15, color: T.ink2, lineHeight: 1.5,
                  }}>
                    <Icon name="lock" size={15} color={T.olive} strokeWidth={1.3} style={{ marginTop: 3 }} />
                    {line}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <Btn size="lg" onClick={() => navigate('/signin?new=1')}>{CTA.begin}</Btn>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ImageSlot label="Framed photos on a hallway wall" height={230} />
            <ImageSlot label="A notebook kept for years" height={170} />
          </div>
        </div>
      </div>
    </SitePage>
  )
}
