import { useState } from 'react'
import ArchiveShell from './ArchiveShell'
import { useArchiveContext } from './data'
import { EmptyState, Loading, SectionHeader } from './parts'
import GalleryUploadModal from '../GalleryUploadModal'
import { interviewApi, uploadMedia } from '../../lib/api'
import { ACTIONS, can } from '../../lib/permissions'
import { T, radius, sans, serif } from '../../design/tokens'
import { Body, Btn, Icon, ImageSlot, PrivacyNote } from '../../design/ui'

export default function PhotosScreen({ creatorIdParam }: { creatorIdParam?: string }) {
  const ctx = useArchiveContext(creatorIdParam)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (ctx.loading) return <Loading label="Opening the photographs…" />
  if (ctx.error || !ctx.profile) return <Loading label={ctx.error || 'Nothing here yet.'} />

  const { role, creatorId, profile } = ctx
  const items = profile.gallery || []
  const mayUpload = can(role, ACTIONS.UPLOAD_MEDIA)

  const save = async (file: File, caption: string, title: string) => {
    if (!creatorId) return
    setSaving(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const imagePath = await uploadMedia(creatorId, 'gallery', file, ext, file.type)
      await interviewApi.createGalleryItem({ creatorId, imagePath, caption, title: title || undefined })
      setOpen(false)
      ctx.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add this photograph')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Remove this photograph from the archive?')) return
    try {
      await interviewApi.deleteGalleryItem(id)
      ctx.reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not remove this photograph')
    }
  }

  return (
    <ArchiveShell
      active="photos" role={role} creatorId={creatorId}
      creatorName={profile.creator?.display_name || 'Your'} portraitUrl={ctx.portraitUrl}
    >
      <GalleryUploadModal
        open={open} saving={saving} error={error}
        onSave={save} onClose={() => !saving && setOpen(false)}
      />

      <SectionHeader
        eyebrow="The archive"
        title="Photos & documents"
        note="Photographs, letters, and papers that belong with the stories."
        actions={mayUpload ? <Btn icon="plus" onClick={() => setOpen(true)}>Add a photograph</Btn> : undefined}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="photo" title="Nothing added yet"
          note="A photograph gives a story a face and a place. Add one and it sits alongside the entry it belongs to."
          cta={mayUpload ? 'Add a photograph' : undefined}
          onCta={mayUpload ? () => setOpen(true) : undefined}
        />
      ) : (
        <div style={{
          display: 'grid', gap: 16,
          gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))',
        }}>
          {items.map((g) => (
            <figure key={g.id} style={{
              margin: 0, background: T.card, border: `1px solid ${T.cardEdge}`,
              borderRadius: radius.md, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: 10, paddingBottom: 0 }}>
                <ImageSlot label="Photograph" src={g.imageUrl} height={178} />
              </div>
              <figcaption style={{ padding: '13px 14px 15px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {g.title && (
                  <span style={{ fontFamily: serif, fontSize: 17, color: T.ink }}>{g.title}</span>
                )}
                <span style={{ fontFamily: sans, fontSize: 13, color: T.ink2, lineHeight: 1.5 }}>{g.caption}</span>
                {mayUpload && (
                  <button
                    type="button" onClick={() => remove(g.id)}
                    style={{
                      alignSelf: 'flex-start', marginTop: 4, background: 'none', border: 'none',
                      padding: 0, cursor: 'pointer', fontFamily: sans, fontSize: 12.5,
                      color: T.ink3, display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Icon name="pen" size={13} color={T.ink3} strokeWidth={1.3} />
                    Remove
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <div style={{ marginTop: 22, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <PrivacyNote>Only invited family can access this</PrivacyNote>
        <Body size={13} color={T.ink3}>
          {items.length} {items.length === 1 ? 'photograph' : 'photographs'} added
        </Body>
      </div>
    </ArchiveShell>
  )
}
