import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useArchiveContext } from './data'
import { SectionHeader } from './parts'
import {
  accessApi, type InvitationRow, type MemberRow, type Role,
} from '../../lib/api'
import { ACTIONS, can, normalizeRole } from '../../lib/permissions'
import { T, radius, sans } from '../../design/tokens'
import { CTA, TRUST } from '../../design/copy'
import { Body, Btn, Display, Divider, Icon, Panel, PrivacyNote, Select } from '../../design/ui'

const ROLE_LABEL: Record<Role, string> = {
  creator: 'You',
  administrator: 'Administrator',
  member: 'Family member',
}

const ROLE_NOTE: Record<Role, string> = {
  creator: 'Full control of your archive',
  administrator: 'Can invite family and manage access. Cannot change your entries.',
  member: 'Can read and listen to what you have shared. Nothing else.',
}

export default function FamilyAccessScreen() {
  const ctx = useArchiveContext()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastLink, setLastLink] = useState<string | null>(null)
  const creatorId = ctx.creatorId

  const load = useCallback(async () => {
    if (!creatorId) return
    try {
      const [m, inv] = await Promise.all([
        accessApi.members(creatorId),
        accessApi.invitations(creatorId).catch(() => ({ creatorId, invitations: [] as InvitationRow[] })),
      ])
      setMembers(m.members)
      setInvitations(inv.invitations)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load family access')
    }
  }, [creatorId])

  useEffect(() => { void load() }, [load])

  if (!ctx.profile) return null

  const role = ctx.role
  const mayInvite = can(role, ACTIONS.INVITE_USER)
  const mayManage = can(role, ACTIONS.MANAGE_ACCESS)
  const mayAppoint = can(role, ACTIONS.APPOINT_ADMIN)
  const invited = members.filter((m) => normalizeRole(m.role) !== 'creator')
  const pending = invitations.filter((i) => i.status === 'pending')

  const createInvite = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await accessApi.invite({ role: inviteRole, creatorId })
      const link = `${window.location.origin}/join?token=${res.invitation.token}`
      setLastLink(link)
      setNotice('Invitation link created. Send it to the person you want to invite.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create an invitation')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (token: string) => {
    const link = `${window.location.origin}/join?token=${token}`
    try {
      await navigator.clipboard.writeText(link)
      setNotice('Link copied.')
    } catch {
      setLastLink(link)
    }
  }

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this invitation link?')) return
    try {
      await accessApi.revokeInvitation(id, creatorId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke this invitation')
    }
  }

  const changeRole = async (userId: string, next: Role) => {
    try {
      await accessApi.setMemberRole(userId, next, creatorId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change this permission')
    }
  }

  const remove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name}’s access to this archive?`)) return
    try {
      await accessApi.removeMember(userId, creatorId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove this person')
    }
  }

  const row: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, padding: '14px 0', borderTop: `1px solid ${T.lineSoft}`, flexWrap: 'wrap',
  }

  return (
    <>
      <SectionHeader
        eyebrow="Permissions"
        title="Family Access"
        note={mayAppoint
          ? 'Only people you invite can open this archive. You can change or remove access at any time.'
          : mayInvite
            ? 'You can invite family and remove access. You cannot change what is in the archive.'
            : 'Who can open this archive.'}
      />

      {error && (
        <Panel pad="14px 18px" style={{ marginBottom: 16, borderColor: 'rgba(150,77,43,.4)' }}>
          <Body size={14} color={T.siennaDeep}>{error}</Body>
        </Panel>
      )}

      <div className="overview-grid" style={{
        display: 'grid', gap: 18,
        gridTemplateColumns: 'minmax(340px, 1.5fr) minmax(260px, .8fr)', alignItems: 'start',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {mayInvite && (
            <Panel pad="22px 24px">
              <Display size={20} style={{ marginBottom: 6 }}>Invite family</Display>
              <Body size={14} style={{ marginBottom: 16 }}>
                Create a private link for one person. They set up their own account, and see only
                what this archive allows.
              </Body>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 220, flex: '1 1 220px' }}>
                  <Select
                    label="Access level"
                    value={inviteRole}
                    onChange={(v) => setInviteRole(v as Role)}
                  >
                    <option value="member">Family member — read and listen</option>
                    {mayAppoint && <option value="administrator">Administrator — manage access</option>}
                  </Select>
                </div>
                <Btn onClick={createInvite} disabled={busy}>
                  {busy ? 'Creating…' : CTA.invite}
                </Btn>
              </div>
              <Body size={13} color={T.ink3} style={{ marginTop: 12 }}>{ROLE_NOTE[inviteRole]}</Body>
              {notice && <Body size={13} color={T.olive} style={{ marginTop: 10 }}>{notice}</Body>}
              {lastLink && (
                <div style={{
                  marginTop: 14, padding: '12px 14px', background: T.paper,
                  border: `1px solid ${T.line}`, borderRadius: radius.sm,
                  fontFamily: sans, fontSize: 13, color: T.ink2, wordBreak: 'break-all',
                }}>{lastLink}</div>
              )}
            </Panel>
          )}

          {pending.length > 0 && (
            <Panel pad="22px 24px">
              <Display size={20} style={{ marginBottom: 10 }}>Invitations waiting</Display>
              {pending.map((i) => (
                <div key={i.id} style={row}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: sans, fontSize: 14.5, color: T.ink }}>
                      {ROLE_LABEL[i.role]} link
                    </span>
                    <span style={{ fontFamily: sans, fontSize: 12.5, color: T.ink3 }}>
                      Created {new Date(i.created_at).toLocaleDateString()} · expires {new Date(i.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn tone="quiet" size="sm" onClick={() => copy(i.token)}>Copy link</Btn>
                    <Btn tone="quiet" size="sm" onClick={() => revoke(i.id)}>Revoke</Btn>
                  </div>
                </div>
              ))}
            </Panel>
          )}

          <Panel pad="22px 24px">
            <Display size={20} style={{ marginBottom: 10 }}>Invited family</Display>
            {invited.length === 0 ? (
              <Body size={14}>
                {mayAppoint
                  ? 'No one has been invited yet. This archive is visible only to you.'
                  : 'No one has been invited yet. This archive is visible only to its owner.'}
              </Body>
            ) : invited.map((m) => {
              const name = m.name || m.email || 'Family member'
              const r = (normalizeRole(m.role) || 'member') as Role
              return (
                <div key={m.user_id} style={row}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ fontFamily: sans, fontSize: 14.5, fontWeight: 600, color: T.ink }}>{name}</span>
                    <span style={{ fontFamily: sans, fontSize: 12.5, color: T.ink3 }}>
                      {ROLE_LABEL[r]}{m.email ? ` · ${m.email}` : ''}
                    </span>
                  </div>
                  {mayManage && (mayAppoint || r === 'member') && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {mayAppoint && (
                        <Select
                          label="Access level"
                          value={r}
                          onChange={(v) => changeRole(m.user_id, v as Role)}
                        >
                          <option value="member">Family member</option>
                          <option value="administrator">Administrator</option>
                        </Select>
                      )}
                      <Btn tone="quiet" size="sm" onClick={() => remove(m.user_id, name)}>Remove</Btn>
                    </div>
                  )}
                </div>
              )
            })}
          </Panel>
        </div>

        <Panel onDark pad="24px 26px" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Icon name="lock" size={22} color={T.gold} />
          <Display size={22} color={T.onDark}>Private by default</Display>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TRUST.map((line) => (
              <span key={line} style={{
                display: 'flex', gap: 9, alignItems: 'flex-start',
                fontFamily: sans, fontSize: 13.5, color: T.onDark2, lineHeight: 1.5,
              }}>
                <Icon name="check" size={15} color="rgba(179,144,47,.9)" strokeWidth={1.5} style={{ marginTop: 3 }} />
                {line}
              </span>
            ))}
          </div>
          <Divider tone="dark" />
          <PrivacyNote onDark>Only invited family can access this</PrivacyNote>
        </Panel>
      </div>
    </>
  )
}
