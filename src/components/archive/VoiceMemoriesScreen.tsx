import { useState } from 'react'
import ArchiveShell from './ArchiveShell'
import { useArchiveContext } from './data'
import { Loading, SectionHeader, VoiceMemoryPanel } from './parts'
import VoiceRecordModal from '../VoiceRecordModal'
import { avatarApi, uploadMedia } from '../../lib/api'
import { ACTIONS, can } from '../../lib/permissions'
import { T, radius, sans } from '../../design/tokens'
import { CTA, TRUST } from '../../design/copy'
import { Body, Btn, Display, Divider, Icon, Panel, PrivacyNote } from '../../design/ui'

export default function VoiceMemoriesScreen({ creatorIdParam }: { creatorIdParam?: string }) {
  const ctx = useArchiveContext(creatorIdParam)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  if (ctx.loading) return <Loading label="Opening the voice memories…" />
  if (ctx.error || !ctx.profile) return <Loading label={ctx.error || 'Nothing here yet.'} />

  const { role, creatorId, profile } = ctx
  const voiceUrl = ctx.assets?.urls?.voiceSample || null
  const mayRecord = can(role, ACTIONS.RECORD_VOICE)
  const firstMemory = profile.memories?.[0]

  const save = async (wav: Blob) => {
    if (!creatorId) throw new Error('Could not find your archive — refresh and try again.')
    setSaving(true)
    setError(null)
    try {
      const path = await uploadMedia(creatorId, 'voice-sample', wav, 'wav', 'audio/wav')
      await avatarApi.saveVoiceSample(path)
      setOpen(false)
      ctx.reload()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save this recording'
      setError(message)
      throw e instanceof Error ? e : new Error(message)
    } finally {
      setSaving(false)
    }
  }

  const play = () => {
    if (!voiceUrl) return
    const audio = new Audio(voiceUrl)
    setPlaying(true)
    audio.onended = () => setPlaying(false)
    void audio.play().catch(() => setPlaying(false))
  }

  return (
    <ArchiveShell
      active="voice" role={role} creatorId={creatorId}
      creatorName={profile.creator?.display_name || 'Your'} portraitUrl={ctx.portraitUrl}
    >
      <VoiceRecordModal
        open={open} saving={saving} error={error} hasExisting={Boolean(voiceUrl)}
        onSave={save} onClose={() => !saving && setOpen(false)}
      />

      <SectionHeader
        eyebrow="The archive"
        title="Voice memories"
        note="Recordings kept in your own voice, so a story arrives the way you told it."
        actions={mayRecord ? <Btn icon="voice" onClick={() => setOpen(true)}>{CTA.recordVoice}</Btn> : undefined}
      />

      <div style={{
        display: 'grid', gap: 18,
        gridTemplateColumns: 'minmax(340px, 1.4fr) minmax(260px, .8fr)', alignItems: 'start',
      }}>
        {voiceUrl ? (
          <VoiceMemoryPanel
            title={firstMemory?.title || 'Your voice sample'}
            meta={['Recorded in your voice', firstMemory?.year || undefined]}
            quote={firstMemory?.summary
              ? `${firstMemory.summary.slice(0, 150)}${firstMemory.summary.length > 150 ? '…' : ''}`
              : undefined}
            attribution={profile.creator?.display_name || undefined}
            playing={playing}
            onToggle={play}
          />
        ) : (
          <Panel onDark pad="34px 30px" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Icon name="voice" size={24} color={T.gold} />
            <Display size={27} color={T.onDark}>No voice memory yet</Display>
            <Body size={15} color={T.onDark2} style={{ maxWidth: 420 }}>
              Read a short passage aloud and the archive can answer more personally, in a voice
              your family already knows. Nothing is shared until you say so.
            </Body>
            {mayRecord && (
              <div style={{ marginTop: 4 }}>
                <Btn onClick={() => setOpen(true)}>Record a voice sample</Btn>
              </div>
            )}
            <PrivacyNote onDark>Voice and likeness require explicit permission</PrivacyNote>
          </Panel>
        )}

        <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Display size={19}>How this is used</Display>
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
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: sans,
            fontSize: 12.5, color: T.ink3, border: `1px solid ${T.lineSoft}`,
            borderRadius: radius.pill, padding: '5px 12px', alignSelf: 'flex-start',
          }}>
            <Icon name="lock" size={13} color={T.ink3} strokeWidth={1.3} />
            Only invited family can access this
          </span>
        </Panel>
      </div>
    </ArchiveShell>
  )
}
