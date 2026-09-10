import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react'
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import { useArchiveContext } from './data'
import type { ArchiveOutlet } from './ArchiveLayout'
import { SectionHeader } from './parts'
import { canEditArchive, canManageAccess, canSetUpLiveAvatar } from './sections'
import MemoryEditorModal, { type MemoryFormValues } from '../MemoryEditorModal'
import GalleryUploadModal from '../GalleryUploadModal'
import VoiceRecordModal from '../VoiceRecordModal'
import { avatarApi, interviewApi, uploadMedia } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { T, radius, sans, serif } from '../../design/tokens'
import { CTA, TRUST } from '../../design/copy'
import {
  Body, Btn, Display, Divider, Eyebrow, Icon, ImageSlot, Meta, Panel, PrivacyNote,
} from '../../design/ui'

type Entry = {
  id?: string
  title?: string
  summary?: string
  category?: string
  year?: string
}

/**
 * The owner's workshop. Reached from the bottom-left archive identity in the
 * side navigation, and only by the archive owner — everyone else is sent back
 * to the main screen.
 */
export default function EditArchiveScreen() {
  const { viewerEmail } = useOutletContext<ArchiveOutlet>()
  const navigate = useNavigate()
  const ctx = useArchiveContext()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [savingPortrait, setSavingPortrait] = useState(false)
  const [identityNotice, setIdentityNotice] = useState<string | null>(null)
  const [identityError, setIdentityError] = useState<string | null>(null)

  const [entry, setEntry] = useState<{ mode: 'add' | 'edit'; row?: Entry } | null>(null)
  const [entrySaving, setEntrySaving] = useState(false)
  const [entryError, setEntryError] = useState<string | null>(null)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  useEffect(() => {
    if (ctx.profile?.creator?.display_name) setName(ctx.profile.creator.display_name)
  }, [ctx.profile?.creator?.display_name])

  if (!ctx.profile) return null
  if (!canEditArchive(ctx.role)) {
    return <Navigate to={`/overview${ctx.creatorId ? `?c=${ctx.creatorId}` : ''}`} replace />
  }

  const { profile, role, creatorId, counts, setupPct } = ctx
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const entries: Entry[] = profile.memories || []
  const photos = profile.gallery || []
  const voiceUrl = ctx.assets?.urls?.voiceSample || null
  const liveReady = ctx.assets?.liveReady === true
  const voiceCloned = ctx.assets?.voiceCloned === true
  const hasPortrait = Boolean(ctx.assets?.assets?.portrait_path)

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setIdentityError('Enter a name for your archive.')
      return
    }
    setSavingName(true)
    setIdentityError(null)
    setIdentityNotice(null)
    try {
      await avatarApi.saveIdentity({ displayName: trimmed })
      await supabase.auth.updateUser({ data: { full_name: trimmed } })
      setIdentityNotice('Name saved.')
      ctx.reload()
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : 'Could not save your name')
    } finally {
      setSavingName(false)
    }
  }

  const savePortrait = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !creatorId) return
    setSavingPortrait(true)
    setIdentityError(null)
    setIdentityNotice(null)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/jpeg/, 'jpg')
      const path = await uploadMedia(creatorId, 'portrait', file, ext, file.type)
      await avatarApi.saveAssets({ portraitPath: path })
      setIdentityNotice('Photograph saved.')
      ctx.reload()
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : 'Could not save this photograph')
    } finally {
      setSavingPortrait(false)
    }
  }

  const saveEntry = async (values: MemoryFormValues) => {
    setEntrySaving(true)
    setEntryError(null)
    try {
      if (entry?.mode === 'edit' && entry.row?.id) await interviewApi.updateMemory(entry.row.id, values)
      else if (creatorId) await interviewApi.createMemory({ creatorId, ...values })
      setEntry(null)
      ctx.reload()
    } catch (e) {
      setEntryError(e instanceof Error ? e.message : 'Could not save this entry')
    } finally {
      setEntrySaving(false)
    }
  }

  const deleteEntry = async () => {
    const id = entry?.row?.id
    if (!id) return
    if (!window.confirm(`Remove “${entry?.row?.title || 'this entry'}” from the archive?`)) return
    setEntrySaving(true)
    try {
      await interviewApi.deleteMemory(id)
      setEntry(null)
      ctx.reload()
    } catch (e) {
      setEntryError(e instanceof Error ? e.message : 'Could not remove this entry')
    } finally {
      setEntrySaving(false)
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

  const removePhoto = async (id: string) => {
    if (!window.confirm('Remove this photograph from the archive?')) return
    try {
      await interviewApi.deleteGalleryItem(id)
      ctx.reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not remove this photograph')
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

  const statusChip = (label: string, done: boolean) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: sans, fontSize: 12.5,
      color: done ? T.olive : T.ink3, border: `1px solid ${done ? 'rgba(60,68,51,.35)' : T.lineSoft}`,
      borderRadius: radius.pill, padding: '4px 11px',
    }}>
      <Icon name={done ? 'check' : 'clock'} size={13} color={done ? T.olive : T.ink3} strokeWidth={1.4} />
      {label}
    </span>
  )

  const inputStyle: CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: T.paper,
    border: `1px solid ${T.line}`, borderRadius: radius.sm, padding: '10px 12px',
    fontFamily: sans, fontSize: 15, color: T.ink, outline: 'none',
  }

  return (
    <>
      <MemoryEditorModal
        open={entry !== null} mode={entry?.mode || 'add'}
        initial={entry?.row ? {
          title: entry.row.title || '',
          summary: entry.row.summary || '',
          year: entry.row.year || '',
          category: entry.row.category || 'story',
        } : undefined}
        saving={entrySaving} error={entryError} onSave={saveEntry}
        onDelete={entry?.mode === 'edit' ? deleteEntry : undefined}
        onClose={() => !entrySaving && setEntry(null)}
      />
      <GalleryUploadModal
        open={photoOpen} saving={photoSaving} error={photoError}
        onSave={savePhoto} onClose={() => !photoSaving && setPhotoOpen(false)}
      />
      <VoiceRecordModal
        open={voiceOpen} saving={voiceSaving} error={voiceError} hasExisting={Boolean(voiceUrl)}
        onSave={saveVoice} onClose={() => !voiceSaving && setVoiceOpen(false)}
      />

      <SectionHeader
        eyebrow="Only you can see this page"
        title="Edit your archive"
        note="Add, correct, or remove anything. Family sees the archive, never this workshop."
        actions={
          <>
            <Btn tone="quiet" icon="overview" onClick={() => navigate(`/overview${cQuery}`)}>
              View the archive
            </Btn>
            <Btn icon="interview" onClick={() => navigate(`/interview${cQuery}`)}>{CTA.continueInterview}</Btn>
          </>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Panel pad="18px 22px" style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          background: T.paperDeep, border: `1px solid ${T.line}`,
        }}>
          <Eyebrow>Archive setup: {setupPct}% complete</Eyebrow>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {statusChip(`${counts.stories} stories`, counts.stories > 0)}
            {statusChip(voiceUrl ? 'Voice recorded' : 'No voice yet', Boolean(voiceUrl))}
            {statusChip(`${counts.photographs} photographs`, counts.photographs > 0)}
            {statusChip(hasPortrait ? 'Portrait added' : 'No portrait yet', hasPortrait)}
            {statusChip(liveReady ? 'Live avatar ready' : 'No live avatar yet', liveReady)}
          </span>
        </Panel>

        {/* name + photograph */}
        <Panel pad="22px 24px">
          <Display size={22} style={{ marginBottom: 16 }}>Your name and photograph</Display>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <button
                type="button" disabled={savingPortrait} onClick={() => fileRef.current?.click()}
                title="Upload a photograph"
                style={{
                  position: 'relative', width: 88, height: 88, padding: 0, borderRadius: radius.pill,
                  border: `1px solid ${T.cardEdge}`, background: T.paperDeep, overflow: 'hidden',
                  cursor: 'pointer', flex: '0 0 auto',
                }}
              >
                {ctx.portraitUrl ? (
                  <img
                    src={ctx.portraitUrl} alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
                    <Icon name="people" size={32} color={T.ink3} />
                  </span>
                )}
                <span style={{
                  position: 'absolute', inset: 'auto 0 0', padding: '6px 0 7px',
                  background: 'rgba(30,23,18,.55)', color: T.onDark,
                  fontFamily: sans, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
                }}>
                  {savingPortrait ? 'Saving…' : ctx.portraitUrl ? 'Change' : 'Upload'}
                </span>
              </button>
              <input
                ref={fileRef} type="file" hidden
                accept="image/jpeg,image/png,image/webp,image/*"
                onChange={(e) => void savePortrait(e)}
              />
            </div>
            <form
              onSubmit={(e) => void saveName(e)}
              style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 260 }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Eyebrow>Archive name</Eyebrow>
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  maxLength={80} required style={inputStyle}
                />
              </label>
              {viewerEmail && <Body size={13.5} color={T.ink3}>{viewerEmail}</Body>}
              <div>
                <Btn type="submit" size="sm" disabled={savingName || !name.trim()}>
                  {savingName ? 'Saving…' : 'Save name'}
                </Btn>
              </div>
              {(identityNotice || identityError) && (
                <Body size={13.5} color={identityError ? T.siennaDeep : T.olive}>
                  {identityError || identityNotice}
                </Body>
              )}
            </form>
          </div>
        </Panel>

        {/* entries */}
        <Panel pad="22px 24px">
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap', marginBottom: 14,
          }}>
            <Display size={22}>Entries</Display>
            <Btn size="sm" icon="plus" onClick={() => setEntry({ mode: 'add' })}>{CTA.addEntry}</Btn>
          </div>
          {entries.length === 0 ? (
            <Body size={14.5}>
              Nothing yet. The guided interview is the quickest way to fill this in, or add an entry by hand.
            </Body>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {entries.map((m, i) => (
                <div key={m.id || i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${T.lineSoft}`, flexWrap: 'wrap',
                }}>
                  <span style={{ fontFamily: serif, fontSize: 14, color: T.gold, minWidth: 24 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
                    <span style={{ fontFamily: serif, fontSize: 18, color: T.ink }}>
                      {m.title || 'Untitled entry'}
                    </span>
                    <Meta items={[m.category, m.year]} />
                  </span>
                  <Btn tone="quiet" size="sm" icon="pen" onClick={() => setEntry({ mode: 'edit', row: m })}>
                    {CTA.edit}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="overview-grid" style={{
          display: 'grid', gap: 18,
          gridTemplateColumns: 'minmax(320px, 1.1fr) minmax(300px, .9fr)', alignItems: 'start',
        }}>
          {/* photographs */}
          <Panel pad="22px 24px">
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              gap: 16, flexWrap: 'wrap', marginBottom: 14,
            }}>
              <Display size={22}>Photos & documents</Display>
              <Btn size="sm" tone="quiet" icon="plus" onClick={() => setPhotoOpen(true)}>Add a photograph</Btn>
            </div>
            {photos.length === 0 ? (
              <Body size={14.5}>No photographs yet. A picture gives a story a face and a place.</Body>
            ) : (
              <div style={{
                display: 'grid', gap: 12,
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              }}>
                {photos.map((g) => (
                  <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <ImageSlot label="Photograph" src={g.imageUrl} height={116} />
                    <span style={{
                      fontFamily: sans, fontSize: 12.5, color: T.ink2, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{g.title || g.caption}</span>
                    <button
                      type="button" onClick={() => void removePhoto(g.id)}
                      style={{
                        alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0,
                        cursor: 'pointer', fontFamily: sans, fontSize: 12, color: T.ink3,
                      }}
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* voice + live avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Display size={22}>Voice memories</Display>
              <Body size={14.5}>
                {voiceUrl
                  ? 'A recording is in place. Record again to replace it.'
                  : 'Read a short passage aloud and your family hears the story in your voice.'}
              </Body>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn tone="quiet" size="sm" icon="voice" onClick={() => setVoiceOpen(true)}>
                  {voiceUrl ? 'Record again' : CTA.recordVoice}
                </Btn>
              </div>
              <PrivacyNote>Voice and likeness require explicit permission</PrivacyNote>
            </Panel>

            {canSetUpLiveAvatar(role) && (
              <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  gap: 16, flexWrap: 'wrap',
                }}>
                  <Display size={22}>Live avatar</Display>
                  <Btn
                    size="sm"
                    tone={liveReady ? 'quiet' : 'primary'}
                    icon={liveReady ? 'pen' : 'live'}
                    onClick={() => navigate(`/voice-and-photo${cQuery}`)}
                  >
                    {liveReady ? CTA.editLive : CTA.createLive}
                  </Btn>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 92, flex: '0 0 auto' }}>
                    <ImageSlot label="Portrait" src={ctx.portraitUrl} height={92} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                    <Body size={14.5}>
                      {liveReady
                        ? 'Ready for a live call. Edit to replace the photograph or voice and generate again.'
                        : 'Record a voice, take or upload a front-facing photograph, then generate. Family talks with you on Ask the archive.'}
                    </Body>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {statusChip(hasPortrait ? 'Portrait added' : 'Portrait needed', hasPortrait)}
                      {statusChip(voiceCloned ? 'Voice ready' : 'Voice needed', voiceCloned)}
                      {statusChip(liveReady ? 'Live avatar ready' : 'Not set up', liveReady)}
                    </div>
                  </div>
                </div>
                <PrivacyNote>Voice and likeness require explicit permission</PrivacyNote>
              </Panel>
            )}
          </div>
        </div>

        <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Display size={20}>Who can see all this</Display>
          <Body size={14.5}>
            Nothing in your archive is visible to anyone until you invite them. Administrators can
            manage invitations; they cannot change your entries.
          </Body>
          <Divider />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
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
          {canManageAccess(role) && (
            <div style={{ marginTop: 4 }}>
              <Btn tone="quiet" size="sm" icon="lock" onClick={() => navigate(`/family-access${cQuery}`)}>
                {CTA.manage}
              </Btn>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
