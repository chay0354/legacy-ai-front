import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ArchiveShell from './ArchiveShell'
import { useArchiveContext } from './data'
import { EmptyState, Loading, SectionHeader } from './parts'
import MemoryEditorModal, { type MemoryFormValues } from '../MemoryEditorModal'
import { interviewApi } from '../../lib/api'
import { ACTIONS, can } from '../../lib/permissions'
import { T, radius, sans, serif } from '../../design/tokens'
import { CTA, STATUS } from '../../design/copy'
import { Body, Btn, Display, Eyebrow, Icon, Meta, Panel } from '../../design/ui'

type Entry = {
  id?: string
  title?: string
  summary?: string
  category?: string
  year?: string
  lesson_learned?: string
  people_involved?: string[]
}

export default function StoriesScreen({ creatorIdParam }: { creatorIdParam?: string }) {
  const navigate = useNavigate()
  const ctx = useArchiveContext(creatorIdParam)
  const [editing, setEditing] = useState<{ mode: 'add' | 'edit'; entry?: Entry } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (ctx.loading) return <Loading label="Opening the stories…" />
  if (ctx.error || !ctx.profile) return <Loading label={ctx.error || 'Nothing here yet.'} />

  const { role, creatorId, profile } = ctx
  const entries: Entry[] = profile.memories || []
  const mayEdit = can(role, ACTIONS.EDIT_MEMORY)

  const save = async (values: MemoryFormValues) => {
    setSaving(true)
    setError(null)
    try {
      if (editing?.mode === 'edit' && editing.entry?.id) {
        await interviewApi.updateMemory(editing.entry.id, values)
      } else if (creatorId) {
        await interviewApi.createMemory({ creatorId, ...values })
      }
      setEditing(null)
      ctx.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this entry')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const id = editing?.entry?.id
    if (!id) return
    if (!window.confirm(`Remove “${editing?.entry?.title || 'this entry'}” from the archive?`)) return
    setSaving(true)
    try {
      await interviewApi.deleteMemory(id)
      setEditing(null)
      ctx.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove this entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ArchiveShell
      active="stories" role={role} creatorId={creatorId}
      creatorName={profile.creator?.display_name || 'Your'} portraitUrl={ctx.portraitUrl}
    >
      <MemoryEditorModal
        open={editing !== null}
        mode={editing?.mode || 'add'}
        initial={editing?.entry ? {
          title: editing.entry.title || '',
          summary: editing.entry.summary || '',
          year: editing.entry.year || '',
          category: editing.entry.category || 'story',
        } : undefined}
        saving={saving} error={error}
        onSave={save}
        onDelete={editing?.mode === 'edit' ? remove : undefined}
        onClose={() => !saving && setEditing(null)}
      />

      <SectionHeader
        eyebrow="The archive"
        title="Stories"
        note="Every entry gathered so far, in your own words. Each one stays yours to edit."
        actions={mayEdit ? (
          <>
            <Btn tone="quiet" icon="interview" onClick={() => navigate('/interview')}>{CTA.continueInterview}</Btn>
            <Btn icon="plus" onClick={() => setEditing({ mode: 'add' })}>{CTA.addEntry}</Btn>
          </>
        ) : undefined}
      />

      {entries.length === 0 ? (
        <EmptyState
          icon="story" title="No stories gathered yet"
          note="The guided interview is the quickest way to start. Answer a few questions and the first entries appear here."
          cta={mayEdit ? CTA.beginInterview : undefined}
          onCta={mayEdit ? () => navigate('/interview') : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {entries.map((m, i) => (
            <Panel key={m.id || i} pad="22px 26px">
              <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
                <span style={{
                  fontFamily: serif, fontSize: 15, color: T.gold, paddingTop: 4,
                  minWidth: 26, letterSpacing: '.04em',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                    <Display size={22}>{m.title || 'Untitled entry'}</Display>
                    <Meta items={[
                      m.category ? m.category[0].toUpperCase() + m.category.slice(1) : 'Story',
                      m.year,
                    ]} />
                  </div>
                  {m.summary && <Body size={15}>{m.summary}</Body>}
                  {m.lesson_learned && (
                    <div style={{
                      borderLeft: `1px solid rgba(179,144,47,.5)`, paddingLeft: 14, marginTop: 2,
                    }}>
                      <span style={{
                        fontFamily: serif, fontStyle: 'italic', fontSize: 16, color: T.ink2, lineHeight: 1.5,
                      }}>{m.lesson_learned}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                    {m.people_involved && m.people_involved.length > 0 && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        fontFamily: sans, fontSize: 13, color: T.ink3,
                      }}>
                        <Icon name="people" size={15} color={T.ink3} strokeWidth={1.3} />
                        {m.people_involved.slice(0, 3).join(', ')}
                      </span>
                    )}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      fontFamily: sans, fontSize: 12.5, color: T.ink3,
                      border: `1px solid ${T.lineSoft}`, borderRadius: radius.pill, padding: '3px 10px',
                    }}>
                      <Icon name="lock" size={13} color={T.ink3} strokeWidth={1.3} />
                      {STATUS.private}
                    </span>
                    {mayEdit && (
                      <button
                        type="button"
                        onClick={() => setEditing({ mode: 'edit', entry: m })}
                        style={{
                          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7,
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          fontFamily: sans, fontSize: 13.5, fontWeight: 600, color: T.sienna,
                        }}
                      >
                        <Icon name="pen" size={15} strokeWidth={1.4} />
                        {CTA.edit}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          ))}
          <div style={{ paddingTop: 6 }}>
            <Eyebrow>{entries.length} {entries.length === 1 ? 'entry' : 'entries'} in the archive</Eyebrow>
          </div>
        </div>
      )}
    </ArchiveShell>
  )
}
