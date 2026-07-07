import { useCallback, useEffect, useState } from 'react'
import { accessApi, type InvitationRow, type MemberRow, type Role } from '../lib/api'

const C = {
  paper: '#ece3d2', panel: '#f4ecdc', card: '#fbf6ec',
  ink: '#2b241c', ink2: '#6e6253', ink3: '#9a8d79', line: '#ddccb0',
  terra: '#c06a44', umber: '#7a5236', gold: '#b3902f', sage: '#71805c',
}
const serif = "'Newsreader', Georgia, serif"
const sans = "'Hanken Grotesk', system-ui, sans-serif"
const mono = "'Spline Sans Mono', ui-monospace, monospace"

const ROLE_LABEL: Record<Role, string> = {
  creator: 'Creator',
  administrator: 'Administrator',
  member: 'Member',
}

const ROLE_BLURB: Record<Role, string> = {
  creator: 'Owns the legacy — full control over content and access.',
  administrator: 'Opens the link, signs up or signs in, and joins as administrator. Can then invite family as members.',
  member: 'Opens the link, signs up or signs in, and can view the legacy and talk with the avatar.',
}

function inviteLink(token: string) {
  return `${window.location.origin}/join?token=${token}`
}

interface ManageAccessProps {
  creatorId?: string
  onBack: () => void
}

export default function ManageAccess({ creatorId, onBack }: ManageAccessProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [callerRole, setCallerRole] = useState<Role | null>(null)
  const [resolvedCreatorId, setResolvedCreatorId] = useState<string | undefined>(creatorId)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])

  const [inviteRole, setInviteRole] = useState<Role>('administrator')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [lastLink, setLastLink] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const m = await accessApi.members(creatorId)
      setCallerRole(m.role)
      setResolvedCreatorId(m.creatorId)
      setMembers(m.members)
      const inv = await accessApi.invitations(m.creatorId)
      setInvitations(inv.invitations)
      if (m.role === 'administrator') setInviteRole('member')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load access settings')
    } finally {
      setLoading(false)
    }
  }, [creatorId])

  useEffect(() => { load() }, [load])

  const isCreator = callerRole === 'creator'

  const createLink = async () => {
    setBusy(true)
    setNotice(null)
    setLastLink(null)
    try {
      const { invitation } = await accessApi.invite({ role: inviteRole, creatorId: resolvedCreatorId })
      const link = inviteLink(invitation.token)
      setLastLink(link)
      try {
        await navigator.clipboard.writeText(link)
        setNotice('Link created and copied. Send it to the person you’re inviting.')
      } catch {
        setNotice('Link created — copy it below and send it to the person you’re inviting.')
      }
      await load()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Failed to create link')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async (token: string) => {
    const link = inviteLink(token)
    try {
      await navigator.clipboard.writeText(link)
      setNotice('Link copied to clipboard.')
    } catch {
      setNotice(link)
    }
  }

  const revoke = async (id: string) => {
    await accessApi.revokeInvitation(id, resolvedCreatorId)
    await load()
  }

  const changeRole = async (userId: string, role: Role) => {
    await accessApi.setMemberRole(userId, role, resolvedCreatorId)
    await load()
  }

  const remove = async (userId: string) => {
    if (!confirm('Remove this person’s access?')) return
    await accessApi.removeMember(userId, resolvedCreatorId)
    await load()
  }

  const pending = invitations.filter((i) => i.status === 'pending')

  return (
    <div className="legacy-manage legacy-page-with-nav" style={{ minHeight: '100dvh', background: C.paper, fontFamily: sans, color: C.ink, padding: '0 0 80px' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(236,227,210,.9)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.line}` }}>
        <div className="legacy-top-nav-inner" style={{ maxWidth: 860, margin: '0 auto', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: serif, fontSize: 20 }}>Manage access</div>
          <button onClick={onBack} style={ghostBtn}>← Back</button>
        </div>
      </div>

      <div className="legacy-manage-pad" style={{ maxWidth: 860, margin: '0 auto', padding: '36px 28px' }}>
        {loading && <p style={{ color: C.ink2 }}>Loading…</p>}
        {error && (
          <div style={errorBox}>
            <strong>Couldn’t load access settings.</strong>
            <p style={{ margin: '8px 0 0', fontSize: 14 }}>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: C.ink3, margin: 0 }}>
              You are {callerRole ? ROLE_LABEL[callerRole] : '—'}
            </p>
            <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 34, margin: '6px 0 4px' }}>Who can see this legacy</h1>
            <p style={{ color: C.ink2, fontSize: 15, margin: 0, maxWidth: 580 }}>
              {isCreator
                ? 'Create a private link and send it to someone you trust. They open the link, create an account or sign in, and join automatically — as an administrator or a family member, depending on the link you create.'
                : 'Create a private link for a family member. They open it, sign up or sign in, and join as a member who can view this legacy and talk with the avatar.'}
            </p>

            <section style={card}>
              <h2 style={sectionTitle}>Create an invite link</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ flex: '0 0 240px' }}>
                  <span style={fieldLabel}>Role for this link</span>
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)} style={input}>
                    {isCreator && <option value="administrator">Administrator — manage access</option>}
                    <option value="member">Member — view &amp; chat</option>
                  </select>
                </label>
                <button type="button" onClick={createLink} disabled={busy} style={primaryBtn}>
                  {busy ? 'Creating…' : 'Create link'}
                </button>
              </div>
              <p style={{ fontSize: 13, color: C.ink3, margin: '12px 0 0' }}>{ROLE_BLURB[inviteRole]}</p>
              {notice && <p style={{ fontSize: 13, color: C.umber, margin: '10px 0 0' }}>{notice}</p>}
              {lastLink && (
                <div style={{ marginTop: 14, padding: '12px 14px', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, wordBreak: 'break-all', color: C.ink2 }}>
                  {lastLink}
                </div>
              )}
            </section>

            {pending.length > 0 && (
              <section style={card}>
                <h2 style={sectionTitle}>Active invite links</h2>
                {pending.map((i) => (
                  <div key={i.id} className="legacy-manage-row" style={row}>
                    <div>
                      <div style={{ fontSize: 15 }}>{ROLE_LABEL[i.role]} link</div>
                      <div style={{ fontSize: 12, color: C.ink3 }}>Created {new Date(i.created_at).toLocaleDateString()} · expires {new Date(i.expires_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => copyLink(i.token)} style={ghostBtn}>Copy link</button>
                      <button onClick={() => revoke(i.id)} style={dangerGhost}>Revoke</button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section style={card}>
              <h2 style={sectionTitle}>People with access</h2>
              {members.map((m) => (
                <div key={m.user_id} className="legacy-manage-row" style={row}>
                  <div>
                    <div style={{ fontSize: 15 }}>{m.name || m.email || 'Family member'}</div>
                    <div style={{ fontSize: 12, color: C.ink3 }}>
                      {ROLE_LABEL[m.role]}
                      {m.email ? ` · ${m.email}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {m.role !== 'creator' && isCreator && (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.user_id, e.target.value as Role)}
                        style={{ ...input, padding: '6px 10px', width: 'auto' }}
                      >
                        <option value="member">Member</option>
                        <option value="administrator">Administrator</option>
                      </select>
                    )}
                    {m.role !== 'creator' && (
                      <button onClick={() => remove(m.user_id)} style={dangerGhost}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '22px 24px', marginTop: 22 }
const sectionTitle: React.CSSProperties = { fontFamily: serif, fontWeight: 500, fontSize: 20, margin: '0 0 16px' }
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, color: C.ink3, marginBottom: 6, fontFamily: mono, letterSpacing: '.08em', textTransform: 'uppercase' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontFamily: sans, fontSize: 14, color: C.ink, outline: 'none' }
const primaryBtn: React.CSSProperties = { background: C.terra, color: '#fbf6ec', border: 'none', borderRadius: 999, padding: '11px 22px', fontFamily: sans, fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { background: 'transparent', border: `1px solid ${C.line}`, color: C.ink2, borderRadius: 999, padding: '8px 16px', fontFamily: sans, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const dangerGhost: React.CSSProperties = { background: 'transparent', border: `1px solid ${C.line}`, color: '#a8503a', borderRadius: 999, padding: '8px 16px', fontFamily: sans, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: `1px solid ${C.line}` }
const errorBox: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 20px', color: C.ink2 }
