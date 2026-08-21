import { useNavigate } from 'react-router-dom'
import { useArchiveContext } from './data'
import { SectionHeader } from './parts'
import { canSetUpLiveAvatar } from './sections'
import AvatarStudio from '../AvatarStudio'
import { T } from '../../design/tokens'
import { Body, Btn, Display, Eyebrow, Panel } from '../../design/ui'

/**
 * Portrait and voice capture, and live-avatar provisioning. Owner only —
 * this is the one surface that touches voice and likeness.
 */
export default function VoiceAndPhotoScreen() {
  const ctx = useArchiveContext()
  const navigate = useNavigate()

  if (!ctx.profile) return null

  const { role, creatorId } = ctx
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const liveReady = ctx.assets?.liveReady === true
  const voiceCloned = ctx.assets?.voiceCloned === true

  if (!canSetUpLiveAvatar(role)) {
    return (
      <Panel pad="22px 24px">
        <Body size={14.5}>Only the archive owner can set up voice and likeness.</Body>
      </Panel>
    )
  }

  return (
    <>
      <SectionHeader
        eyebrow="Only you can see this page"
        title="Voice & photograph"
        note="Record your voice, take or upload a front-facing photograph, then generate. When it is ready, family can talk with you on Ask the archive."
        actions={
          <Btn tone="quiet" icon="pen" onClick={() => navigate(`/edit${cQuery}`)}>
            Back to editing
          </Btn>
        }
      />

      <Panel pad="22px 24px">
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', marginBottom: 10,
        }}>
          <Display size={20}>Studio</Display>
          <Eyebrow color={liveReady ? T.olive : T.ink3}>
            {liveReady
              ? 'Ready for live call'
              : voiceCloned
                ? 'Voice ready — finish the photograph and generate'
                : 'Not set up yet'}
          </Eyebrow>
        </div>
        <AvatarStudio
          embedded
          onExit={() => {
            ctx.reload()
            navigate(`/ask${cQuery}`)
          }}
        />
      </Panel>
    </>
  )
}
