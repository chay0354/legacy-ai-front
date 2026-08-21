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
        <Display size={33}>{title}</Display>
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
    <Panel pad={0} style={{ overflow: 'hidden', display: 'flex', minHeight: 176 }}>
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="interview" size={17} color={T.gold} strokeWidth={1.4} />
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <Display size={22}>{title}</Display>
        <Body size={14} style={{ maxWidth: 340 }}>{note}</Body>
        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
          <Btn tone="secondary" onClick={onCta}>{cta}</Btn>
        </div>
      </div>
      <div style={{ flex: '0 0 30%', minWidth: 96, maxWidth: 190, background: T.paperDeep }}>
        {imageSrc
          ? <img src={imageSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{
              width: '100%', height: '100%',
              background: `linear-gradient(150deg, ${T.walnutSoft}, ${T.walnut})`,
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="story" size={26} color="rgba(240,231,214,.35)" />
            </div>}
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
      minHeight: '100dvh', display: 'grid', placeItems: 'center',
      background: T.paper, fontFamily: serif, fontSize: 17, color: T.ink2,
    }}>{label}</div>
  )
}
