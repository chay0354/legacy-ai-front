import ArchiveShell from './ArchiveShell'
import { useArchiveContext } from './data'
import { EmptyState, Loading, SectionHeader } from './parts'
import { useNavigate } from 'react-router-dom'
import { ACTIONS, can } from '../../lib/permissions'
import { T, radius, sans, serif } from '../../design/tokens'
import { CTA } from '../../design/copy'
import { Body, Btn, Display, Eyebrow, Icon, Panel } from '../../design/ui'

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 2) || '—'
}

export default function PeopleScreen({ creatorIdParam }: { creatorIdParam?: string }) {
  const navigate = useNavigate()
  const ctx = useArchiveContext(creatorIdParam)

  if (ctx.loading) return <Loading label="Opening the people…" />
  if (ctx.error || !ctx.profile) return <Loading label={ctx.error || 'Nothing here yet.'} />

  const { role, creatorId, profile } = ctx
  const people = profile.relationships || []
  const mayInterview = can(role, ACTIONS.COMPLETE_INTERVIEW)

  return (
    <ArchiveShell
      active="people" role={role} creatorId={creatorId}
      creatorName={profile.creator?.display_name || 'Your'} portraitUrl={ctx.portraitUrl}
    >
      <SectionHeader
        eyebrow="The archive"
        title="People"
        note="The people who belong to these stories, and how they shaped them."
        actions={mayInterview
          ? <Btn tone="quiet" icon="interview" onClick={() => navigate('/interview')}>{CTA.continueInterview}</Btn>
          : undefined}
      />

      {people.length === 0 ? (
        <EmptyState
          icon="people" title="No people added yet"
          note="People are added as you talk about them in the interview. Mention a name and it appears here with the stories it belongs to."
          cta={mayInterview ? CTA.continueInterview : undefined}
          onCta={mayInterview ? () => navigate('/interview') : undefined}
        />
      ) : (
        <div style={{
          display: 'grid', gap: 16,
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        }}>
          {people.map((p, i) => (
            <Panel key={`${p.name}-${i}`} pad="20px 22px" style={{ display: 'flex', gap: 15 }}>
              <span style={{
                width: 42, height: 42, borderRadius: radius.pill, flex: '0 0 auto',
                background: T.paperDeep, border: `1px solid ${T.cardEdge}`,
                display: 'grid', placeItems: 'center', fontFamily: serif,
                fontSize: 15, color: T.ink2, letterSpacing: '.04em',
              }}>{initials(p.name)}</span>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Display size={19}>{p.name}</Display>
                <Eyebrow>{p.relationship_type || 'Important person'}</Eyebrow>
                {(p.relationship_summary || p.description) && (
                  <Body size={13.5} style={{ marginTop: 3 }}>
                    {p.relationship_summary || p.description}
                  </Body>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {(profile.values?.length || profile.wisdom?.length) ? (
        <div style={{ marginTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Icon name="story" size={16} color={T.gold} strokeWidth={1.4} />
            <Eyebrow>What they were told</Eyebrow>
          </div>
          <div style={{
            display: 'grid', gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          }}>
            {(profile.wisdom || []).slice(0, 4).map((w, i) => (
              <Panel key={i} pad="20px 22px" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{
                  fontFamily: serif, fontStyle: 'italic', fontSize: 17.5, lineHeight: 1.5, color: T.ink,
                }}>{w.advice_statement}</span>
                {(w.life_category || w.supporting_story) && (
                  <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3 }}>
                    {w.life_category || w.supporting_story}
                  </span>
                )}
              </Panel>
            ))}
          </div>
        </div>
      ) : null}
    </ArchiveShell>
  )
}
