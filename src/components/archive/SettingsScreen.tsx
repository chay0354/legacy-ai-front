import { useNavigate, useOutletContext } from 'react-router-dom'
import { useArchiveContext } from './data'
import type { ArchiveOutlet } from './ArchiveLayout'
import { SectionHeader } from './parts'
import { canEditArchive, canManageAccess, canRunInterview, isOwner } from './sections'
import { supabase } from '../../lib/supabase'
import { clearAuthTokenCache } from '../../lib/api'
import { T, radius, sans } from '../../design/tokens'
import { CTA, TRUST, archiveSetupLabel, countsLine } from '../../design/copy'
import { Body, Btn, Display, Divider, Eyebrow, Icon, Panel, PrivacyNote } from '../../design/ui'

/** Account, profile, privacy, sign out. Never a second edit surface. */
export default function SettingsScreen() {
  const { viewerEmail, viewerName } = useOutletContext<ArchiveOutlet>()
  const navigate = useNavigate()
  const ctx = useArchiveContext()

  if (!ctx.profile) return null

  const { role, creatorId, profile, counts, setupPct } = ctx
  const name = profile.creator?.display_name || 'This archive'
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const owner = isOwner(role)
  const mayEdit = canEditArchive(role)
  const profileName = owner ? name : (viewerName || viewerEmail || 'Your account')

  const signOut = async () => {
    clearAuthTokenCache()
    sessionStorage.removeItem('legacy-ai:pending-join-token')
    localStorage.removeItem('legacy-ai:pending-join-token')
    localStorage.removeItem('legacy-ai:last-creator-id')
    await supabase.auth.signOut()
    navigate('/')
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '15px 0', borderTop: `1px solid ${T.lineSoft}`, flexWrap: 'wrap',
  }

  return (
    <>
      <SectionHeader
        eyebrow="Your account"
        title="Settings"
        note={owner
          ? 'Your profile, your archive, and who can reach it.'
          : 'Your account on this device. The archive itself belongs to its owner.'}
      />

      <div className="overview-grid" style={{
        display: 'grid', gap: 18,
        gridTemplateColumns: 'minmax(340px, 1.4fr) minmax(260px, .85fr)', alignItems: 'start',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Panel pad="22px 24px">
            <Display size={20} style={{ marginBottom: 14 }}>Profile</Display>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {owner && ctx.portraitUrl ? (
                <img
                  src={ctx.portraitUrl} alt=""
                  style={{
                    width: 62, height: 62, borderRadius: radius.pill, objectFit: 'cover',
                    border: `1px solid ${T.cardEdge}`,
                  }}
                />
              ) : (
                <span style={{
                  width: 62, height: 62, borderRadius: radius.pill, background: T.paperDeep,
                  border: `1px solid ${T.cardEdge}`, display: 'grid', placeItems: 'center',
                }}>
                  <Icon name="people" size={24} color={T.ink3} />
                </span>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <Display size={22}>{profileName}</Display>
                {viewerEmail && <Body size={13.5} color={T.ink3}>{viewerEmail}</Body>}
              </div>
              {mayEdit && (
                <div style={{ marginLeft: 'auto' }}>
                  <Btn tone="quiet" size="sm" icon="pen" onClick={() => navigate(`/edit${cQuery}`)}>
                    Edit archive
                  </Btn>
                </div>
              )}
            </div>
          </Panel>

          <Panel pad="22px 24px">
            <Display size={20} style={{ marginBottom: 6 }}>
              {owner ? 'Your archive' : `${name.split(' ')[0]}’s archive`}
            </Display>
            <Eyebrow>{archiveSetupLabel(setupPct)}</Eyebrow>
            <Body size={13.5} style={{ marginTop: 10 }}>
              {countsLine({
                stories: counts.stories, voice: counts.voice,
                people: counts.people, photographs: counts.photographs,
              })}
            </Body>
            <div style={rowStyle}>
              <span style={{ fontFamily: sans, fontSize: 14.5, color: T.ink }}>Who can open this archive</span>
              {canManageAccess(role)
                ? <Btn tone="quiet" size="sm" onClick={() => navigate(`/family-access${cQuery}`)}>{CTA.manage}</Btn>
                : <Body size={13} color={T.ink3}>Managed by the archive owner</Body>}
            </div>
            {canRunInterview(role) && (
              <div style={rowStyle}>
                <span style={{ fontFamily: sans, fontSize: 14.5, color: T.ink }}>Continue the guided interview</span>
                <Btn tone="quiet" size="sm" onClick={() => navigate(`/interview${cQuery}`)}>{CTA.continueInterview}</Btn>
              </div>
            )}
            <div style={rowStyle}>
              <span style={{ fontFamily: sans, fontSize: 14.5, color: T.ink }}>Sign out of this device</span>
              <Btn tone="quiet" size="sm" onClick={() => void signOut()}>Sign out</Btn>
            </div>
          </Panel>
        </div>

        <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Display size={19}>Privacy</Display>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TRUST.map((line) => (
              <span key={line} style={{
                display: 'flex', gap: 9, alignItems: 'flex-start',
                fontFamily: sans, fontSize: 13.5, color: T.ink2, lineHeight: 1.5,
              }}>
                <Icon name="check" size={15} color={T.olive} strokeWidth={1.5} style={{ marginTop: 3 }} />
                {line}
              </span>
            ))}
          </div>
          <Divider />
          <PrivacyNote>Private by default</PrivacyNote>
        </Panel>
      </div>
    </>
  )
}
