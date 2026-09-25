import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  adminApi,
  adminEmail,
  adminToken,
  clearAdminSession,
  setAdminSession,
  type AdminBilling,
  type AdminOverview,
  type AdminUserDetail,
  type AdminUserRow,
} from '../lib/adminApi'
import { T, radius, sans, serif } from '../design/tokens'
import { BRAND, BRAND_SUB } from '../design/copy'
import { Body, Btn, Display, Divider, Eyebrow, Panel } from '../design/ui'

const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: T.card,
  border: `1px solid ${T.line}`, borderRadius: radius.sm, padding: '11px 13px',
  fontFamily: sans, fontSize: 15, color: T.ink, outline: 'none',
}

function planLabel(plan?: string | null) {
  if (plan === 'setup') return 'Package'
  if (plan === 'monthly') return 'Monthly'
  if (plan === 'storage') return 'Storage'
  if (plan === 'preserve') return 'Preserve'
  if (plan === 'family') return 'Family'
  if (plan === 'archive') return 'The Archive'
  return 'None'
}

function moneyDate(iso?: string | null) {
  if (!iso) return 'no end date'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const PLAN_PRICE: Record<string, { amount: string; every: 'month' | null }> = {
  setup: { amount: '$699', every: null },
  monthly: { amount: '$69.90', every: 'month' },
  storage: { amount: '$6.99', every: 'month' },
  preserve: { amount: '$6.99', every: null },
  archive: { amount: '$19', every: 'month' },
  family: { amount: '$39', every: 'month' },
}

function billingFacts(b: AdminBilling) {
  const price = PLAN_PRICE[b.plan]
  const complimentary = b.source === 'comp' || b.source === 'credit'
  if (!b.paid || !price) {
    return { pays: 'Not paying', charge: 'No upcoming charge' }
  }
  if (complimentary) {
    return { pays: 'Complimentary — not charged', charge: 'No upcoming charge' }
  }
  if (!price.every) {
    const until = b.currentPeriodEnd ? ` Included until ${moneyDate(b.currentPeriodEnd)}.` : ''
    return { pays: `${price.amount} once`, charge: `No recurring charge.${until}` }
  }
  if (b.cancelAtPeriodEnd && b.currentPeriodEnd) {
    return { pays: `${price.amount} / month`, charge: `Cancels ${moneyDate(b.currentPeriodEnd)}. No further charge.` }
  }
  if (b.currentPeriodEnd) {
    return { pays: `${price.amount} / month`, charge: moneyDate(b.currentPeriodEnd) }
  }
  return { pays: `${price.amount} / month`, charge: 'No charge date on file' }
}

function Login({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    adminApi.configured()
      .then((r) => setConfigured(r.configured))
      .catch(() => setConfigured(false))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await adminApi.login(email.trim(), password)
      setAdminSession(res.token, res.email)
      onIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.paper, display: 'grid', placeItems: 'center', padding: 28 }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontFamily: serif, fontSize: 26, color: T.ink }}>{BRAND}</div>
          <Eyebrow style={{ marginTop: 6 }}>{BRAND_SUB} · Staff</Eyebrow>
        </div>
        <Display size={32}>Sign in to the desk</Display>
        <Body size={14.5}>
          This is not a customer account. Use the staff email and password set on the server.
        </Body>
        {configured === false && (
          <Body size={13.5} color={T.siennaDeep}>
            Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD on the API.
          </Body>
        )}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Eyebrow>Email</Eyebrow>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={input} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Eyebrow>Password</Eyebrow>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={input} />
          </label>
          {error && <Body size={13.5} color={T.siennaDeep}>{error}</Body>}
          <Btn type="submit" disabled={busy || configured === false} style={{ justifyContent: 'center' }}>
            {busy ? 'Checking…' : 'Open the desk'}
          </Btn>
        </form>
        <Link to="/" style={{ fontFamily: sans, fontSize: 13.5, color: T.ink3 }}>Back to the site</Link>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel pad="18px 20px">
      <Eyebrow>{label}</Eyebrow>
      <div style={{ fontFamily: serif, fontSize: 28, color: T.ink, marginTop: 6 }}>{value}</div>
    </Panel>
  )
}

function UserDetail({
  id, onBack, onGone,
}: { id: string; onBack: () => void; onGone: () => void }) {
  const [data, setData] = useState<AdminUserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [months, setMonths] = useState(1)
  const [creditPlan, setCreditPlan] = useState<'archive' | 'family'>('archive')
  const [archiveName, setArchiveName] = useState<Record<string, string>>({})

  const load = () => {
    adminApi.user(id)
      .then((d) => {
        setData(d)
        const names: Record<string, string> = {}
        for (const a of d.archives) names[a.id] = a.display_name || ''
        setArchiveName(names)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load user'))
  }

  useEffect(() => { load() }, [id])

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  if (!data) {
    return <Body>{error || 'Opening the account…'}</Body>
  }

  const u = data.user
  const b = data.billing
  const pay = billingFacts(b)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <button
        type="button"
        onClick={onBack}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: sans, fontSize: 13.5, color: T.sienna }}
      >
        ← All accounts
      </button>
      <div>
        <Eyebrow>Account</Eyebrow>
        <Display size={30}>{u.name || u.email || u.id}</Display>
        <Body size={14}>{u.email}</Body>
        <Body size={13} color={T.ink3}>
          Created {moneyDate(u.createdAt)} · last sign-in {u.lastSignInAt ? moneyDate(u.lastSignInAt) : 'never'} ·
          {u.emailConfirmed ? ' email confirmed' : ' email unconfirmed'}
        </Body>
      </div>

      <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Display size={20}>Payment</Display>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <div>
            <Eyebrow>Plan</Eyebrow>
            <Body size={15}>{b.paid ? planLabel(b.plan) : 'None'}</Body>
          </div>
          <div>
            <Eyebrow>Pays</Eyebrow>
            <Body size={15}>{pay.pays}</Body>
          </div>
          <div>
            <Eyebrow>Next charge</Eyebrow>
            <Body size={15}>{pay.charge}</Body>
          </div>
        </div>
        {b.notes && <Body size={13.5} color={T.ink3}>{b.notes}</Body>}
        {b.stripeCustomerId && (
          <Body size={13} color={T.ink3}>
            Stripe {b.stripeCustomerId}{b.stripeSubscriptionId ? ` · ${b.stripeSubscriptionId}` : ''}
          </Body>
        )}
        <Divider />
        <Eyebrow>Give credit</Eyebrow>
        <Body size={13.5}>Adds paid months without charging the card. Access closes when the date passes.</Body>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select value={creditPlan} onChange={(e) => setCreditPlan(e.target.value as 'archive' | 'family')} style={{ ...input, width: 'auto' }}>
            <option value="archive">The Archive</option>
            <option value="family">Family</option>
          </select>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
            {[1, 2, 3, 6, 12].map((n) => <option key={n} value={n}>{n} month{n === 1 ? '' : 's'}</option>)}
          </select>
          <Btn disabled={Boolean(busy)} onClick={() => void run('credit', () => adminApi.credit(u.id, months, creditPlan))}>
            {busy === 'credit' ? 'Granting…' : 'Grant credit'}
          </Btn>
        </div>
        {(b.credits || []).length > 0 && (
          <div>
            <Eyebrow>Credit history</Eyebrow>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontFamily: sans, fontSize: 13.5, color: T.ink2 }}>
              {(b.credits || []).slice().reverse().map((c, i) => (
                <li key={`${c.at}-${i}`}>{moneyDate(c.at)} — {c.months} mo {planLabel(c.plan)}{c.notes ? ` · ${c.notes}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Display size={20}>Archives</Display>
        {data.archives.length === 0 && <Body size={14}>No archive created yet.</Body>}
        {data.archives.map((a) => (
          <div key={a.id} style={{ border: `1px solid ${T.line}`, borderRadius: radius.sm, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Body size={14} color={T.ink}>{a.display_name || 'Untitled archive'} · {a.memoryCount} stories · stage {a.avatar_level}</Body>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <input
                value={archiveName[a.id] ?? ''}
                onChange={(e) => setArchiveName((s) => ({ ...s, [a.id]: e.target.value }))}
                style={{ ...input, maxWidth: 240 }}
              />
              <Btn tone="quiet" size="sm" disabled={Boolean(busy)} onClick={() => void run(`name-${a.id}`, () => adminApi.updateArchive(a.id, { displayName: archiveName[a.id] }))}>
                Save name
              </Btn>
              <Btn tone="quiet" size="sm" disabled={Boolean(busy)} onClick={() => void run(`del-a-${a.id}`, async () => {
                if (!window.confirm('Delete this archive and its memberships?')) return
                await adminApi.deleteArchive(a.id)
              })}>
                Delete archive
              </Btn>
            </div>
            {a.members.map((m) => (
              <div key={`${m.user_id}-${m.role}`} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Body size={13}>{m.user_id === u.id ? 'Owner' : m.user_id.slice(0, 8)} · {m.role}</Body>
                {m.user_id !== u.id && (
                  <>
                    <select
                      defaultValue={m.role}
                      onChange={(e) => void run(`role-${m.user_id}`, () => adminApi.setMemberRole(m.user_id, a.id, e.target.value))}
                      style={{ ...input, width: 'auto' }}
                    >
                      <option value="member">member</option>
                      <option value="administrator">administrator</option>
                      <option value="creator">creator</option>
                    </select>
                    <Btn tone="quiet" size="sm" onClick={() => void run(`rm-${m.user_id}`, () => adminApi.removeMember(m.user_id, a.id))}>
                      Remove
                    </Btn>
                  </>
                )}
              </div>
            ))}
            {a.invitations.filter((i) => i.status === 'pending').map((inv) => (
              <div key={inv.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Body size={13}>Invite {inv.email || 'link'} · {inv.role}</Body>
                <Btn tone="quiet" size="sm" onClick={() => void run(`inv-${inv.id}`, () => adminApi.revokeInvitation(inv.id))}>
                  Revoke invite
                </Btn>
              </div>
            ))}
          </div>
        ))}
      </Panel>

      <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Display size={20}>Account tools</Display>
        {!u.emailConfirmed && (
          <Btn tone="quiet" disabled={Boolean(busy)} onClick={() => void run('confirm', () => adminApi.confirmEmail(u.id))}>
            Confirm email
          </Btn>
        )}
        <Btn
          tone="quiet"
          disabled={Boolean(busy)}
          onClick={() => void run('delete', async () => {
            if (!window.confirm(`Delete ${u.email || 'this user'} and their archives? This cannot be undone.`)) return
            await adminApi.deleteUser(u.id)
            onGone()
          })}
        >
          Delete user
        </Btn>
      </Panel>
      {error && <Body size={13.5} color={T.siennaDeep}>{error}</Body>}
    </div>
  )
}

function PriceEditor() {
  const [prices, setPrices] = useState<{ id: string; name: string; amount: number; displayPrice: string; interval: string | null }[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.prices()
      .then((r) => {
        setPrices(r.prices)
        const next: Record<string, string> = {}
        for (const p of r.prices) next[p.id] = (p.amount / 100).toFixed(2)
        setDrafts(next)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load prices'))
  }, [])

  const save = async (id: string) => {
    setBusy(id)
    setError(null)
    setNote(null)
    try {
      const res = await adminApi.setPrice(id, Number(drafts[id]))
      setPrices(res.prices)
      setNote(`${res.price.name} is now ${res.price.displayPrice}. New checkouts use this price.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the price')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Display size={22}>Package prices</Display>
      <Body size={14}>New checkouts charge the price you save. People already subscribed keep their current Stripe price.</Body>
      {prices.map((p) => (
        <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Body size={14} style={{ minWidth: 110 }}>{p.name}</Body>
          <Body size={13} color={T.ink3}>now {p.displayPrice}{p.interval ? ` / ${p.interval}` : ' once'}</Body>
          <input
            value={drafts[p.id] ?? ''}
            onChange={(e) => setDrafts((s) => ({ ...s, [p.id]: e.target.value }))}
            inputMode="decimal"
            style={{ ...input, width: 110 }}
          />
          <Btn tone="quiet" size="sm" disabled={Boolean(busy)} onClick={() => void save(p.id)}>
            {busy === p.id ? 'Saving…' : 'Save'}
          </Btn>
        </div>
      ))}
      {note && <Body size={13.5} color={T.olive}>{note}</Body>}
      {error && <Body size={13.5} color={T.siennaDeep}>{error}</Body>}
    </Panel>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => Boolean(adminToken()))
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => {
    setError(null)
    Promise.all([adminApi.overview(), adminApi.users(query)])
      .then(([o, u]) => { setOverview(o); setUsers(u.users) })
      .catch((e) => {
        if ((e as { status?: number }).status === 401) {
          clearAdminSession()
          setAuthed(false)
          return
        }
        setError(e instanceof Error ? e.message : 'Could not load the desk')
      })
  }

  useEffect(() => {
    if (authed) refresh()
  }, [authed])

  if (!authed) return <Login onIn={() => setAuthed(true)} />

  return (
    <div style={{ minHeight: '100dvh', background: T.paper }}>
      <header style={{
        background: T.walnutDeep, color: T.onDark, padding: '18px 28px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontFamily: serif, fontSize: 22 }}>{BRAND}</div>
          <Eyebrow color="rgba(179,144,47,.85)">Staff desk · {adminEmail()}</Eyebrow>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/" style={{ fontFamily: sans, fontSize: 13.5, color: T.onDark2, textDecoration: 'none' }}>Site</Link>
          <Btn
            tone="onDark"
            size="sm"
            onClick={() => { clearAdminSession(); setAuthed(false) }}
          >
            Sign out
          </Btn>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px 72px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {selected ? (
          <UserDetail id={selected} onBack={() => { setSelected(null); refresh() }} onGone={() => { setSelected(null); refresh() }} />
        ) : (
          <>
            <div>
              <Eyebrow>Overview</Eyebrow>
              <Display size={34}>Everyone on the system</Display>
            </div>
            {overview && (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <Stat label="Accounts" value={overview.users} />
                <Stat label="Paying / credited" value={overview.paid} />
                <Stat label="Unpaid" value={overview.unpaid} />
                <Stat label="Archives" value={overview.archives} />
                <Stat label="Open invites" value={overview.pendingInvitations} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') refresh() }}
                placeholder="Search email, name, or id"
                style={{ ...input, maxWidth: 360 }}
              />
              <Btn tone="quiet" onClick={() => refresh()}>Search</Btn>
            </div>
            {error && <Body size={13.5} color={T.siennaDeep}>{error}</Body>}
            <PriceEditor />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelected(u.id)}
                  style={{
                    textAlign: 'left', background: T.card, border: `1px solid ${T.cardEdge}`,
                    borderRadius: radius.sm, padding: '14px 16px', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontFamily: sans, fontSize: 15, color: T.ink, fontWeight: 600 }}>
                    {u.name || u.email || u.id}
                  </div>
                  <div style={{ fontFamily: sans, fontSize: 13.5, color: T.ink2, marginTop: 4 }}>
                    {u.email} · {u.billing.paid ? `${planLabel(u.billing.plan)} · ${moneyDate(u.billing.currentPeriodEnd)}` : 'unpaid'}
                    {u.archiveCount ? ` · ${u.archiveCount} archive${u.archiveCount === 1 ? '' : 's'}` : ''}
                  </div>
                </button>
              ))}
              {users.length === 0 && <Body size={14}>No accounts match.</Body>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
