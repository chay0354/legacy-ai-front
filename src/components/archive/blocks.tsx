import type { ReactNode } from 'react'
import { T, radius, sans, serif } from '../../design/tokens'
import { STATUS, TRUST } from '../../design/copy'
import {
  Body, Btn, Display, Divider, Eyebrow, Icon, type IconName, ImageSlot, Meta, Panel, PrivacyNote,
} from '../../design/ui'
import { VoiceMemoryPanel } from './parts'
import type { LegacyProfile } from '../../lib/mapAvatarData'
import type { MemberRow } from '../../lib/api'
import { normalizeRole } from '../../lib/permissions'

/**
 * Read-only blocks for the bands of the main screen. Nothing here writes —
 * adding, correcting, and removing lives on /edit and belongs to the owner.
 */

/* ─────────────────────────── band scaffolding ─────────────────────────── */
export function Band({
  id, refFn, icon, title, count, note, action, children,
}: {
  id: string
  refFn?: (el: HTMLElement | null) => void
  icon: IconName
  title: string
  count?: string
  note?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} ref={refFn} style={{ scrollMarginTop: 24, paddingTop: 8 }}>
      <header style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 22, flexWrap: 'wrap', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name={icon} size={17} color={T.gold} strokeWidth={1.4} />
            <Eyebrow>{count || 'The archive'}</Eyebrow>
          </span>
          <Display size={28}>{title}</Display>
          {note && <Body size={14.5} style={{ maxWidth: 560 }}>{note}</Body>}
        </div>
        {action}
      </header>
      {children}
      <Divider style={{ margin: '34px 0 30px' }} />
    </section>
  )
}

function Quiet({ children }: { children: ReactNode }) {
  return (
    <Panel pad="30px 26px" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon name="clock" size={18} color={T.ink3} strokeWidth={1.3} />
      <Body size={14.5}>{children}</Body>
    </Panel>
  )
}

/* ───────────────────────────── stories ───────────────────────────── */
export function StoriesBlock({ profile }: { profile: LegacyProfile }) {
  const entries = profile.memories || []
  if (entries.length === 0) {
    return <Quiet>No stories gathered yet. The guided interview fills this in first.</Quiet>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {entries.map((m, i) => (
        <Panel key={m.id || i} pad="20px 24px">
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <span style={{
              fontFamily: serif, fontSize: 15, color: T.gold, paddingTop: 3,
              minWidth: 26, letterSpacing: '.04em',
            }}>{String(i + 1).padStart(2, '0')}</span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                <Display size={21}>{m.title || 'Untitled entry'}</Display>
                <Meta items={[
                  m.category ? m.category[0].toUpperCase() + m.category.slice(1) : 'Story',
                  m.year,
                ]} />
              </div>
              {m.summary && <Body size={14.5}>{m.summary}</Body>}
              {m.lesson_learned && (
                <div style={{ borderLeft: '1px solid rgba(179,144,47,.5)', paddingLeft: 14 }}>
                  <span style={{
                    fontFamily: serif, fontStyle: 'italic', fontSize: 15.5, color: T.ink2, lineHeight: 1.5,
                  }}>{m.lesson_learned}</span>
                </div>
              )}
              {m.people_involved && m.people_involved.length > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontFamily: sans, fontSize: 13, color: T.ink3,
                }}>
                  <Icon name="people" size={14} color={T.ink3} strokeWidth={1.3} />
                  {m.people_involved.slice(0, 4).join(', ')}
                </span>
              )}
            </div>
          </div>
        </Panel>
      ))}
    </div>
  )
}

/* ────────────────────────── voice memories ───────────────────────── */
export function VoiceBlock({
  voiceUrl, playing, onToggle, ownerFirstName, firstMemory, ownVoice,
}: {
  voiceUrl: string | null
  playing: boolean
  onToggle: () => void
  ownerFirstName: string
  firstMemory?: { title?: string; year?: string; summary?: string }
  ownVoice: boolean
}) {
  return (
    <div className="overview-grid" style={{
      display: 'grid', gap: 18,
      gridTemplateColumns: 'minmax(340px, 1.4fr) minmax(260px, .8fr)', alignItems: 'start',
    }}>
      {voiceUrl ? (
        <VoiceMemoryPanel
          title={firstMemory?.title || 'A voice memory'}
          meta={[
            ownVoice ? 'Recorded in your voice' : `Recorded in ${ownerFirstName}’s voice`,
            firstMemory?.year || undefined,
          ]}
          quote={firstMemory?.summary
            ? `${firstMemory.summary.slice(0, 150)}${firstMemory.summary.length > 150 ? '…' : ''}`
            : 'Spoken in the cloned voice — the story, not the clone script.'}
          playing={playing}
          onToggle={onToggle}
        />
      ) : (
        <Panel onDark pad="30px 28px" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Icon name="voice" size={22} color={T.gold} />
          <Display size={25} color={T.onDark}>No voice memory yet</Display>
          <Body size={14.5} color={T.onDark2} style={{ maxWidth: 400 }}>
            {ownVoice
              ? 'Read a short passage aloud and a story arrives the way you told it. Nothing is shared until you say so.'
              : `${ownerFirstName} has not recorded a voice memory yet.`}
          </Body>
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
        <PrivacyNote>{STATUS.onlyInvited}</PrivacyNote>
      </Panel>
    </div>
  )
}

/* ─────────────────────── photos & documents ──────────────────────── */
export function PhotosBlock({
  profile, onAdd,
}: {
  profile: LegacyProfile
  onAdd?: () => void
}) {
  const items = profile.gallery || []
  if (items.length === 0) {
    return (
      <Quiet>
        {onAdd
          ? 'No photographs or documents yet. Add the first one here.'
          : 'No photographs or documents have been added yet.'}
        {onAdd && (
          <div style={{ marginTop: 12 }}>
            <Btn tone="quiet" size="sm" onClick={onAdd}>Add photos</Btn>
          </div>
        )}
      </Quiet>
    )
  }
  return (
    <div style={{
      display: 'grid', gap: 14,
      gridTemplateColumns: 'repeat(auto-fill, minmax(212px, 1fr))',
    }}>
      {items.map((g) => (
        <figure key={g.id} style={{
          margin: 0, background: T.card, border: `1px solid ${T.cardEdge}`,
          borderRadius: radius.md, overflow: 'hidden',
        }}>
          <div style={{ padding: 10, paddingBottom: 0 }}>
            <ImageSlot label="Photograph" src={g.imageUrl} height={162} />
          </div>
          <figcaption style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {g.title && <span style={{ fontFamily: serif, fontSize: 16.5, color: T.ink }}>{g.title}</span>}
            <span style={{ fontFamily: sans, fontSize: 13, color: T.ink2, lineHeight: 1.5 }}>{g.caption}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

/* ────────────────────────────── people ───────────────────────────── */
function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 2) || '—'
}

export function PeopleBlock({ profile }: { profile: LegacyProfile }) {
  const people = profile.relationships || []
  if (people.length === 0) return <Quiet>No people have been added yet.</Quiet>
  return (
    <div style={{
      display: 'grid', gap: 14,
      gridTemplateColumns: 'repeat(auto-fill, minmax(292px, 1fr))',
    }}>
      {people.map((p, i) => (
        <Panel key={`${p.name}-${i}`} pad="18px 20px" style={{ display: 'flex', gap: 14 }}>
          <span style={{
            width: 40, height: 40, borderRadius: radius.pill, flex: '0 0 auto',
            background: T.paperDeep, border: `1px solid ${T.cardEdge}`,
            display: 'grid', placeItems: 'center', fontFamily: serif, fontSize: 14.5, color: T.ink2,
          }}>{initials(p.name)}</span>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Display size={18}>{p.name}</Display>
            <Eyebrow>{p.relationship_type || 'Important person'}</Eyebrow>
            {(p.relationship_summary || p.description) && (
              <Body size={13.5} style={{ marginTop: 2 }}>{p.relationship_summary || p.description}</Body>
            )}
          </div>
        </Panel>
      ))}
    </div>
  )
}

/* ───────────────────────────── wisdom ────────────────────────────── */
export function WisdomBlock({ profile }: { profile: LegacyProfile }) {
  const rows = profile.wisdom || []
  const values = profile.values || []
  if (rows.length === 0 && values.length === 0) {
    return <Quiet>Lessons and values appear here as they come up in conversation.</Quiet>
  }
  return (
    <div style={{
      display: 'grid', gap: 14,
      gridTemplateColumns: 'repeat(auto-fill, minmax(292px, 1fr))',
    }}>
      {rows.map((w, i) => (
        <Panel key={i} pad="20px 22px" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontFamily: serif, fontSize: 30, lineHeight: .6, color: 'rgba(179,144,47,.75)' }}>“</span>
          <span style={{
            fontFamily: serif, fontStyle: 'italic', fontSize: 17, lineHeight: 1.5, color: T.ink,
          }}>{w.advice_statement}</span>
          {(w.life_category || w.supporting_story) && (
            <Eyebrow>{w.life_category || w.supporting_story}</Eyebrow>
          )}
        </Panel>
      ))}
      {values.slice(0, 3).map((v, i) => (
        <Panel key={`v-${i}`} pad="20px 22px" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Eyebrow color={T.olive}>{v.is_core ? 'Core value' : 'Value'}</Eyebrow>
          <Display size={19}>{v.value_name}</Display>
          {(v.description || v.origin_story) && <Body size={13.5}>{v.description || v.origin_story}</Body>}
        </Panel>
      ))}
    </div>
  )
}

/* ─────────────────────────── ask the archive ─────────────────────── */
export function AskBlock({ suggestions, onOpen }: { suggestions: string[]; onOpen: () => void }) {
  return (
    <Panel pad="24px 26px" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Body size={14.5} style={{ maxWidth: 560 }}>
        Ask a question and the archive answers from recorded material only. {STATUS.unknown}.
      </Body>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {suggestions.slice(0, 4).map((q) => (
          <button
            key={q} type="button" onClick={onOpen}
            style={{
              border: `1px solid ${T.line}`, background: T.paper, borderRadius: radius.pill,
              padding: '9px 15px', cursor: 'pointer', fontFamily: serif, fontSize: 15, color: T.ink2,
            }}
          >{q}</button>
        ))}
      </div>
      <div><Btn tone="secondary" icon="ask" onClick={onOpen}>Open Ask the archive</Btn></div>
    </Panel>
  )
}

/* ─────────────────────────── family access ───────────────────────── */
export function AccessBlock({
  members, onManage, canManage,
}: { members: MemberRow[]; onManage: () => void; canManage: boolean }) {
  const invited = members.filter((m) => normalizeRole(m.role) !== 'creator')
  return (
    <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {invited.length === 0 ? (
        <Body size={14.5}>No one has been invited yet. This archive is visible only to its owner.</Body>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {invited.map((m, i) => (
            <div key={m.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${T.lineSoft}`,
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: radius.pill, background: T.paperDeep,
                border: `1px solid ${T.cardEdge}`, display: 'grid', placeItems: 'center',
                fontFamily: serif, fontSize: 12, color: T.ink2,
              }}>{initials(m.name || m.email || '?')}</span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.ink }}>
                  {m.name || m.email || 'Family member'}
                </span>
                <span style={{ fontFamily: sans, fontSize: 12.5, color: T.ink3 }}>
                  {normalizeRole(m.role) === 'administrator' ? 'Administrator' : 'Family member'}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
      <PrivacyNote>{STATUS.onlyInvited}</PrivacyNote>
      {canManage && (
        <div><Btn tone="quiet" size="sm" icon="lock" onClick={onManage}>Manage access</Btn></div>
      )}
    </Panel>
  )
}
