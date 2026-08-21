import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ArchiveShell from './ArchiveShell'
import { useArchiveContext } from './data'
import {
  AccessSummary, ArchiveSetup, Loading, NextAction, RecentActivity, VoiceMemoryPanel,
} from './parts'
import MemoryEditorModal, { type MemoryFormValues } from '../MemoryEditorModal'
import GalleryUploadModal from '../GalleryUploadModal'
import VoiceRecordModal from '../VoiceRecordModal'
import { avatarApi, interviewApi, uploadMedia } from '../../lib/api'
import { ACTIONS, can } from '../../lib/permissions'
import { T, sans } from '../../design/tokens'
import { CTA, DASHBOARD_TAGLINE, STAGES } from '../../design/copy'
import { Body, Btn, Display, Eyebrow, Icon, Panel, PrivacyNote } from '../../design/ui'

function stageAsk(level: number) {
  if (level >= 3) {
    return {
      eyebrow: 'Family Archive',
      title: 'Review and prepare family access',
      note: STAGES.family.note,
      cta: CTA.review,
      stage: null as string | null,
    }
  }
  if (level >= 1) {
    return {
      eyebrow: 'Enrichment',
      title: 'Pick up where you left off',
      note: STAGES.enrichment.note,
      cta: CTA.continueInterview,
      stage: level >= 2 ? 'legacy' : 'enriched',
    }
  }
  return {
    eyebrow: 'Foundation',
    title: 'Begin the guided interview',
    note: STAGES.foundation.note,
    cta: CTA.beginInterview,
    stage: 'foundation',
  }
}

export default function OverviewScreen({
  creatorIdParam, viewerName,
}: { creatorIdParam?: string; viewerName: string }) {
  const navigate = useNavigate()
  const ctx = useArchiveContext(creatorIdParam)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memorySaving, setMemorySaving] = useState(false)
  const [memoryError, setMemoryError] = useState<string | null>(null)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  if (ctx.loading) return <Loading />
  if (ctx.error || !ctx.profile) {
    return (
      <Loading label={ctx.error || 'This archive has nothing in it yet.'} />
    )
  }

  const { creatorId, role, counts, level, setupPct, activity, profile } = ctx
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const isCreator = can(role, ACTIONS.COMPLETE_INTERVIEW)
  const ask = stageAsk(level)
  const firstMemory = profile.memories?.[0]
  const voiceUrl = ctx.assets?.urls?.voiceSample || null

  const saveMemory = async (values: MemoryFormValues) => {
    if (!creatorId) return
    setMemorySaving(true)
    setMemoryError(null)
    try {
      await interviewApi.createMemory({ creatorId, ...values })
      setMemoryOpen(false)
      ctx.reload()
    } catch (e) {
      setMemoryError(e instanceof Error ? e.message : 'Could not save this entry')
    } finally {
      setMemorySaving(false)
    }
  }

  const savePhoto = async (file: File, caption: string, title: string) => {
    if (!creatorId) return
    setPhotoSaving(true)
    setPhotoError(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const imagePath = await uploadMedia(creatorId, 'gallery', file, ext, file.type)
      await interviewApi.createGalleryItem({ creatorId, imagePath, caption, title: title || undefined })
      setPhotoOpen(false)
      ctx.reload()
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Could not add this photograph')
    } finally {
      setPhotoSaving(false)
    }
  }

  const saveVoice = async (wav: Blob) => {
    if (!creatorId) throw new Error('Could not find your archive — refresh and try again.')
    setVoiceSaving(true)
    setVoiceError(null)
    try {
      const path = await uploadMedia(creatorId, 'voice-sample', wav, 'wav', 'audio/wav')
      await avatarApi.saveVoiceSample(path)
      setVoiceOpen(false)
      ctx.reload()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save this recording'
      setVoiceError(message)
      throw e instanceof Error ? e : new Error(message)
    } finally {
      setVoiceSaving(false)
    }
  }

  const playVoice = () => {
    if (!voiceUrl) {
      setVoiceOpen(true)
      return
    }
    const audio = new Audio(voiceUrl)
    setPlaying(true)
    audio.onended = () => setPlaying(false)
    void audio.play().catch(() => setPlaying(false))
  }

  return (
    <ArchiveShell
      active="overview" role={role} creatorId={creatorId}
      creatorName={profile.creator?.display_name || viewerName}
      portraitUrl={ctx.portraitUrl}
    >
      <MemoryEditorModal
        open={memoryOpen} mode="add" saving={memorySaving} error={memoryError}
        onSave={saveMemory} onClose={() => !memorySaving && setMemoryOpen(false)}
      />
      <GalleryUploadModal
        open={photoOpen} saving={photoSaving} error={photoError}
        onSave={savePhoto} onClose={() => !photoSaving && setPhotoOpen(false)}
      />
      <VoiceRecordModal
        open={voiceOpen} saving={voiceSaving} error={voiceError}
        hasExisting={Boolean(voiceUrl)} onSave={saveVoice}
        onClose={() => !voiceSaving && setVoiceOpen(false)}
      />

      <header style={{ marginBottom: 26, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>
          {isCreator
            ? 'Your archive'
            : profile.creator?.display_name
              ? `${profile.creator.display_name}’s archive`
              : 'This archive'}
        </Eyebrow>
        <Display size={36}>Welcome back, {viewerName}.</Display>
        <Body size={15.5}>{DASHBOARD_TAGLINE}</Body>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ArchiveSetup pct={setupPct} level={level} counts={counts} />

        <div className="overview-grid" style={{
          display: 'grid', gap: 18,
          gridTemplateColumns: 'minmax(320px, 1.05fr) minmax(340px, 1.25fr) minmax(260px, .8fr)',
          alignItems: 'start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {isCreator ? (
              <NextAction
                eyebrow={ask.eyebrow} title={ask.title} note={ask.note} cta={ask.cta}
                onCta={() => navigate(ask.stage ? `/interview?stage=${ask.stage}` : `/family-access${cQuery}`)}
              />
            ) : (
              <NextAction
                eyebrow="The archive" title="Read what has been kept"
                note="Stories, voice memories, and photographs, in their own words."
                cta="Open the stories"
                onCta={() => navigate(`/stories${cQuery}`)}
              />
            )}

            <Panel pad="20px 22px" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Display size={19}>Add to the archive</Display>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {can(role, ACTIONS.ADD_MEMORY) && (
                  <Btn tone="quiet" size="sm" icon="plus" onClick={() => setMemoryOpen(true)}>{CTA.addEntry}</Btn>
                )}
                {can(role, ACTIONS.RECORD_VOICE) && (
                  <Btn tone="quiet" size="sm" icon="voice" onClick={() => setVoiceOpen(true)}>{CTA.recordVoice}</Btn>
                )}
                {can(role, ACTIONS.UPLOAD_MEDIA) && (
                  <Btn tone="quiet" size="sm" icon="photo" onClick={() => setPhotoOpen(true)}>Add a photograph</Btn>
                )}
                {can(role, ACTIONS.EDIT_PROFILE) && (
                  <Btn tone="quiet" size="sm" icon="ask" onClick={() => navigate('/voice-and-photo')}>
                    {CTA.addVoicePhoto}
                  </Btn>
                )}
              </div>
              <PrivacyNote>Private by default</PrivacyNote>
            </Panel>
          </div>

          {voiceUrl || firstMemory ? (
            <VoiceMemoryPanel
              title={firstMemory?.title || 'A voice memory'}
              chapter={firstMemory?.year ? `Chapter ${firstMemory.year}` : undefined}
              meta={[
                firstMemory?.category
                  ? firstMemory.category[0].toUpperCase() + firstMemory.category.slice(1)
                  : 'Story',
                firstMemory?.year || undefined,
                voiceUrl ? 'Recorded in your voice' : 'No recording yet',
              ]}
              quote={firstMemory?.summary
                ? `${firstMemory.summary.slice(0, 150)}${firstMemory.summary.length > 150 ? '…' : ''}`
                : undefined}
              attribution={profile.creator?.display_name || undefined}
              playing={playing}
              onToggle={playVoice}
              onAddNote={can(role, ACTIONS.ADD_MEMORY) ? () => setMemoryOpen(true) : undefined}
            />
          ) : (
            <Panel onDark pad="30px 28px" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Icon name="voice" size={22} color={T.gold} />
              <Display size={25} color={T.onDark}>Record a voice memory</Display>
              <Body size={14.5} color={T.onDark2} style={{ maxWidth: 380 }}>
                A few minutes of your voice gives your family something a transcript cannot.
                You choose who ever hears it.
              </Body>
              <div style={{ marginTop: 4 }}>
                <Btn onClick={() => setVoiceOpen(true)}>{CTA.recordVoice}</Btn>
              </div>
              <PrivacyNote onDark>Voice and likeness require explicit permission</PrivacyNote>
            </Panel>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <RecentActivity rows={activity} onViewAll={() => navigate(`/stories${cQuery}`)} />
            <AccessSummary
              invited={Math.max(0, ctx.members.length - 1)}
              canManage={can(role, ACTIONS.INVITE_USER)}
              onManage={() => navigate(`/family-access${cQuery}`)}
            />
          </div>
        </div>

        <Panel pad="18px 24px" style={{
          display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
          background: T.paperDeep, border: `1px solid ${T.line}`,
        }}>
          <PrivacyNote>Private by default</PrivacyNote>
          <span style={{ width: 1, height: 16, background: T.line }} />
          <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3 }}>
            Built only from what you choose to share
          </span>
          <span style={{ width: 1, height: 16, background: T.line }} />
          <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3 }}>
            The archive says when it does not know
          </span>
        </Panel>
      </div>
    </ArchiveShell>
  )
}
