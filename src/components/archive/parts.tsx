import type { ReactNode } from 'react'
import { T, radius, sans, serif } from '../../design/tokens'
import { archiveSetupLabel, countsLine, stageStatusLine, STAGES } from '../../design/copy'
import {
  Body, Btn, Display, Divider, Eyebrow, Icon, type IconName, Meta, Meter, Panel, PrivacyNote,
} from '../../design/ui'
import type { ArchiveActivity, ArchiveCounts } from './data'

/* ───────────────────────── section header ───────────────────────── */
export function SectionHeader({
  eyebrow, title, note, actions,
}: { eyebrow: string; title: string; note?: string; actions?: ReactNode }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 24, flexWrap: 'wrap', marginBottom: 26,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display as="h1" size={33}>{title}</Display>
        {note && <Body size={15} style={{ maxWidth: 560 }}>{note}</Body>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  )
}

/* ───────────────────── archive setup progress ───────────────────── */
const SETUP_STAGES = [
  { key: 'foundation', ...STAGES.foundation, icon: 'folder' as IconName },
  { key: 'enrichment', ...STAGES.enrichment, icon: 'voice' as IconName },
  { key: 'family', ...STAGES.family, icon: 'people' as IconName },
]

export function ArchiveSetup({
  pct, level, counts,
}: { pct: number; level: number; counts: ArchiveCounts }) {
  return (
    <Panel pad="24px 26px 26px">
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 20, flexWrap: 'wrap',
      }}>
        <Eyebrow>{archiveSetupLabel(pct)}</Eyebrow>
        <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3 }}>{stageStatusLine(level)}</span>
      </div>
      <Meter pct={pct} />

      <div className="archive-setup-stages" style={{
        marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0,
      }}>
        {SETUP_STAGES.map((s, i) => {
          const done = level > i
          const current = level === i
          const tone = done ? T.olive : current ? T.sienna : T.ink3
          return (
            <div key={s.key} style={{
              display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px',
              borderLeft: i === 0 ? 'none' : `1px solid ${T.lineSoft}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{
                  width: 26, height: 26, borderRadius: radius.pill, display: 'grid', placeItems: 'center',
                  background: done ? T.olive : current ? 'rgba(176,94,55,.12)' : 'transparent',
                  border: `1px solid ${done ? T.olive : current ? T.sienna : T.line}`,
                }}>
                  <Icon
                    name={done ? 'check' : s.icon} size={14} strokeWidth={1.5}
                    color={done ? T.onDark : tone}
                  />
                </span>
                <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.ink }}>{s.label}</span>
              </div>
              <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3, lineHeight: 1.5 }}>{s.note}</span>
            </div>
          )
        })}
      </div>

      <Divider style={{ margin: '22px 0 14px' }} />
      <span style={{ fontFamily: sans, fontSize: 13.5, color: T.ink2 }}>
        {countsLine({
          stories: counts.stories, voice: counts.voice,
          people: counts.people, photographs: counts.photographs,
        })}
      </span>
    </Panel>
  )
}

/* ───────────────────────── next action card ─────────────────────── */
export function NextAction({
  eyebrow, title, note, cta, onCta, imageSrc,
}: {
  eyebrow: string; title: string; note: string; cta: string
  onCta: () => void; imageSrc?: string | null
}) {
  return (
    <Panel pad={0} className="featured-split" style={{ overflow: 'hidden', display: 'flex', minHeight: 176 }}>
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="interview" size={17} color={T.gold} strokeWidth={1.4} />
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <Display size={22}>{title}</Display>
        <Body size={14} style={{ maxWidth: 340 }}>{note}</Body>
        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
          <Btn onClick={onCta}>{cta}</Btn>
        </div>
      </div>
      {imageSrc && (
        <div style={{ flex: '0 0 38%', minWidth: 140, maxWidth: 240, background: T.paperDeep }}>
          <img src={imageSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
    </Panel>
  )
}

/* ──────────────────────── featured story ───────────────────────── */
export function FeaturedStory({
  eyebrow, title, year, category, summary, lesson, people, imageSrc, cta, onOpen,
}: {
  eyebrow: string
  title: string
  year?: string
  category?: string
  summary?: string
  lesson?: string
  people?: string[]
  imageSrc?: string | null
  cta: string
  onOpen: () => void
}) {
  return (
    <Panel pad={0} className="featured-split" style={{ overflow: 'hidden', display: 'flex', minHeight: 220 }}>
      <div style={{
        padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 10,
        flex: 1, minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="story" size={17} color={T.gold} strokeWidth={1.4} />
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <Display size={26}>{title}</Display>
          <Meta items={[category, year]} />
        </div>
        {summary && <Body size={15} style={{ maxWidth: 560 }}>{summary}</Body>}
        {lesson && (
          <div style={{ borderLeft: '1px solid rgba(179,144,47,.5)', paddingLeft: 14 }}>
            <span style={{
              fontFamily: serif, fontStyle: 'italic', fontSize: 16.5, color: T.ink2, lineHeight: 1.5,
            }}>{lesson}</span>
          </div>
        )}
        {people && people.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontFamily: sans, fontSize: 13, color: T.ink3,
          }}>
            <Icon name="people" size={14} color={T.ink3} strokeWidth={1.3} />
            {people.slice(0, 4).join(', ')}
          </span>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
          <Btn tone="quiet" size="sm" icon="story" onClick={onOpen}>{cta}</Btn>
        </div>
      </div>
      {imageSrc && (
        <div style={{ flex: '0 0 34%', minWidth: 160, maxWidth: 280, background: T.paperDeep }}>
          <img src={imageSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
    </Panel>
  )
}

/* ───────────────────────── photo collage ────────────────────────── */
export function PhotoCollage({
  items, onOpen,
}: {
  items: { id?: string; imageUrl?: string | null; title?: string | null; caption?: string }[]
  onOpen: () => void
}) {
  const photos = items.filter((p) => p.imageUrl).slice(0, 5)
  if (photos.length === 0) {
    return (
      <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
        <Eyebrow>Photographs</Eyebrow>
        <Display size={21}>No photographs yet</Display>
        <Body size={14.5}>Pictures will appear here as they are added to the archive.</Body>
      </Panel>
    )
  }

  const extra = Math.max(0, items.filter((p) => p.imageUrl).length - photos.length)
  const many = photos.length >= 3

  return (
    <Panel pad={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 248 }}>
      <button
        type="button" onClick={onOpen}
        title="Open photographs"
        style={{
          display: 'grid', gap: 3, flex: 1, minHeight: 248, padding: 0, border: 'none',
          cursor: 'pointer', background: T.walnut,
          gridTemplateColumns: many ? '1.35fr 1fr 1fr' : photos.length === 2 ? '1fr 1fr' : '1fr',
          gridTemplateRows: many ? '1fr 1fr' : '1fr',
        }}
        className="photo-collage-grid"
      >
        {photos.map((p, i) => {
          const area = many
            ? (['1 / 1 / 3 / 2', '1 / 2 / 2 / 3', '1 / 3 / 2 / 4', '2 / 2 / 3 / 3', '2 / 3 / 3 / 4'][i])
            : undefined
          const showExtra = extra > 0 && i === photos.length - 1
          return (
            <div key={p.id || i} style={{
              gridArea: area, overflow: 'hidden', background: T.paperDeep, position: 'relative', minHeight: 0,
            }}>
              <img
                src={p.imageUrl!} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {showExtra && (
                <span style={{
                  position: 'absolute', inset: 0, background: 'rgba(30,23,18,.45)',
                  display: 'grid', placeItems: 'center',
                  fontFamily: serif, fontSize: 22, color: T.onDark,
                }}>+{extra}</span>
              )}
            </div>
          )
        })}
      </button>
      <div style={{
        padding: '10px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <Eyebrow>{items.length} {items.length === 1 ? 'photograph' : 'photographs'}</Eyebrow>
        <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.sienna }}>See the gallery</span>
      </div>
    </Panel>
  )
}

/* ───────────────────────── voice memory panel ───────────────────── */
function bars(seed: number, n = 84) {
  let x = seed || 7
  return Array.from({ length: n }, () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return 0.18 + ((x / 2147483648) ** 1.4) * 0.82
  })
}

/** Warm dark panel — the atmospheric anchor on the overview screen. */
export function VoiceMemoryPanel({
  title, meta, quote, attribution, playing, progress = 0.42, onToggle, onAddNote, chapter,
}: {
  title: string
  meta: (string | undefined)[]
  quote?: string
  attribution?: string
  playing?: boolean
  progress?: number
  onToggle?: () => void
  onAddNote?: () => void
  chapter?: string
}) {
  const w = bars(title.length * 31 + 3)
  const cut = Math.round(w.length * Math.max(0, Math.min(1, progress)))
  return (
    <Panel onDark pad="22px 26px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="voice" size={16} color={T.gold} strokeWidth={1.4} />
        <Eyebrow color={T.onDark3}>Voice memory{chapter ? ` · ${chapter}` : ''}</Eyebrow>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Display size={27} color={T.onDark}>{title}</Display>
        <Meta items={meta} color={T.onDark3} />
      </div>

      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 2, height: 74,
        padding: '0 2px', borderBottom: `1px solid ${T.darkLine}`,
      }}>
        {w.map((h, i) => (
          <span key={i} style={{
            flex: 1, height: `${h * 100}%`, borderRadius: 1,
            background: i < cut ? 'rgba(240,231,214,.72)' : 'rgba(240,231,214,.22)',
            transition: 'background .3s ease',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          type="button" onClick={onToggle}
          style={{
            width: 42, height: 42, borderRadius: radius.pill, border: 'none',
            background: T.sienna, cursor: 'pointer', display: 'grid', placeItems: 'center',
          }}
          title={playing ? 'Pause' : 'Play'}
        >
          <Icon
            name={playing ? 'check' : 'play'} size={17}
            color="#fdf8ef" strokeWidth={playing ? 1.6 : 1}
            style={playing ? undefined : { marginLeft: 2 }}
          />
        </button>
        <span style={{ fontFamily: sans, fontSize: 13, color: T.onDark3 }}>
          {playing ? 'Playing' : 'Listen to this memory'}
        </span>
        {onAddNote && (
          <button
            type="button" onClick={onAddNote}
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(240,231,214,.08)', border: `1px solid ${T.darkLine}`,
              borderRadius: radius.sm, padding: '8px 14px', cursor: 'pointer',
              fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.onDark,
            }}
          >
            <Icon name="pen" size={14} strokeWidth={1.4} />
            Add note
          </button>
        )}
      </div>

      {quote && (
        <div style={{
          borderTop: `1px solid ${T.darkLine}`, paddingTop: 16,
          display: 'flex', gap: 12,
        }}>
          <span style={{ fontFamily: serif, fontSize: 30, lineHeight: .8, color: 'rgba(179,144,47,.8)' }}>“</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{
              fontFamily: serif, fontStyle: 'italic', fontSize: 17.5, lineHeight: 1.5,
              color: T.onDark, textWrap: 'pretty',
            }}>{quote}</span>
            {attribution && <Eyebrow color={T.onDark3}>{attribution}</Eyebrow>}
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ───────────────────────── recent activity ──────────────────────── */
export function RecentActivity({
  rows, onViewAll,
}: { rows: ArchiveActivity[]; onViewAll?: () => void }) {
  return (
    <Panel pad="22px 24px">
      <Display size={20} style={{ marginBottom: 4 }}>Recent activity</Display>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.length === 0 && (
          <Body size={14} style={{ paddingTop: 12 }}>
            Nothing yet. Your first interview will start filling this in.
          </Body>
        )}
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start', padding: '15px 0',
            borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${T.lineSoft}`,
          }}>
            <span style={{
              width: 30, height: 30, borderRadius: radius.pill, flex: '0 0 auto',
              background: T.paperDeep, border: `1px solid ${T.cardEdge}`,
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name={r.icon} size={15} color={T.ink2} strokeWidth={1.3} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ fontFamily: sans, fontSize: 13.5, fontWeight: 600, color: T.ink }}>{r.label}</span>
              <span style={{
                fontFamily: sans, fontSize: 13, color: T.ink2, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{r.title}</span>
              {r.detail && <span style={{ fontFamily: sans, fontSize: 12.5, color: T.ink3 }}>{r.detail}</span>}
            </span>
          </div>
        ))}
      </div>
      {onViewAll && rows.length > 0 && (
        <>
          <Divider style={{ margin: '4px 0 14px' }} />
          <button
            type="button" onClick={onViewAll}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontFamily: sans, fontSize: 13.5, fontWeight: 600, color: T.sienna,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            View all activity
            <Icon name="arrow" size={15} strokeWidth={1.5} />
          </button>
        </>
      )}
    </Panel>
  )
}

/* ───────────────────────────── misc ─────────────────────────────── */
export function EmptyState({
  icon, title, note, cta, onCta,
}: { icon: IconName; title: string; note: string; cta?: string; onCta?: () => void }) {
  return (
    <Panel pad="46px 32px" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 12, textAlign: 'center',
    }}>
      <Icon name={icon} size={26} color={T.ink3} />
      <Display size={22}>{title}</Display>
      <Body size={14} style={{ maxWidth: 420 }}>{note}</Body>
      {cta && onCta && <div style={{ marginTop: 8 }}><Btn onClick={onCta}>{cta}</Btn></div>}
    </Panel>
  )
}

export function AccessSummary({
  invited, onManage, canManage,
}: { invited: number; onManage: () => void; canManage: boolean }) {
  return (
    <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Display size={20}>Family access</Display>
      <Body size={14}>
        {invited === 0
          ? 'No one has been invited yet. Only you can see this archive.'
          : `${invited} invited family ${invited === 1 ? 'member' : 'members'} can read what you have chosen to share.`}
      </Body>
      <PrivacyNote>Only invited family can access this</PrivacyNote>
      {canManage && (
        <div style={{ marginTop: 4 }}>
          <Btn tone="quiet" size="sm" onClick={onManage}>
            {invited === 0 ? 'Prepare family access' : 'Manage access'}
          </Btn>
        </div>
      )}
    </Panel>
  )
}

export function Loading({ label = 'Opening your archive…' }: { label?: string }) {
  return (
    <div style={{
      minHeight: 220, display: 'grid', placeItems: 'center',
      fontFamily: serif, fontSize: 17, color: T.ink2, padding: '48px 16px',
    }}>{label}</div>
  )
}
