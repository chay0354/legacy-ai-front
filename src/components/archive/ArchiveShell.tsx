import type { CSSProperties, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { T, paperTexture, radius, sans, serif } from '../../design/tokens'
import { BAND, BRAND, BRAND_SUB, NAV } from '../../design/copy'
import { Divider, Eyebrow, Icon, type IconName } from '../../design/ui'
import { ACTIONS, can, normalizeRole } from '../../lib/permissions'
import type { Role } from '../../lib/api'

export type SectionKey =
  | 'overview' | 'interview' | 'stories' | 'voice' | 'photos'
  | 'people' | 'access' | 'settings' | 'ask'

type NavItem = { key: SectionKey; label: string; icon: IconName; to: string; action?: string }

function navItems(role: Role, cQuery: string): NavItem[] {
  const r = normalizeRole(role) || 'member'
  const items: NavItem[] = [
    { key: 'overview', label: NAV.overview, icon: 'overview', to: `/overview${cQuery}` },
  ]
  if (can(r, ACTIONS.COMPLETE_INTERVIEW)) {
    items.push({ key: 'interview', label: NAV.interview, icon: 'interview', to: '/interview' })
  }
  items.push(
    { key: 'stories', label: NAV.stories, icon: 'story', to: `/stories${cQuery}` },
    { key: 'voice', label: NAV.voice, icon: 'voice', to: `/voice-memories${cQuery}` },
    { key: 'photos', label: NAV.photos, icon: 'photo', to: `/photos${cQuery}` },
    { key: 'people', label: NAV.people, icon: 'people', to: `/people${cQuery}` },
    { key: 'ask', label: 'Ask the archive', icon: 'ask', to: `/ask${cQuery}` },
  )
  if (can(r, ACTIONS.INVITE_USER) || can(r, ACTIONS.MANAGE_ACCESS)) {
    items.push({ key: 'access', label: NAV.access, icon: 'lock', to: `/family-access${cQuery}` })
  }
  items.push({ key: 'settings', label: NAV.settings, icon: 'settings', to: `/settings${cQuery}` })
  return items
}

function Monogram({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 2) || '—'
  return (
    <div style={{
      width: size, height: size, borderRadius: radius.pill, flex: '0 0 auto',
      background: 'rgba(240,231,214,.10)', border: `1px solid ${T.darkLine}`,
      display: 'grid', placeItems: 'center', fontFamily: serif, fontSize: 12,
      letterSpacing: '.06em', color: T.onDark2,
    }}>{initials}</div>
  )
}

/** Editorial bottom band. Structured columns, quiet dividers, no ornament. */
export function EditorialBand({ onLearnMore }: { onLearnMore?: () => void }) {
  const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }
  return (
    <footer className="editorial-band" style={{
      borderTop: `1px solid ${T.line}`, background: T.paperDeep,
      padding: '26px 40px', display: 'grid',
      gridTemplateColumns: 'minmax(180px,1fr) minmax(200px,1.2fr) minmax(200px,1.2fr) minmax(160px,.9fr)',
      gap: 40, alignItems: 'start',
    }}>
      <div style={col}>
        <Eyebrow color={T.ink2}>{BAND.eyebrow}</Eyebrow>
        <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3, lineHeight: 1.55 }}>
          {BAND.line}
        </span>
      </div>
      <div style={{ ...col, borderLeft: `1px solid rgba(179,144,47,.35)`, paddingLeft: 28 }}>
        <span style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.4, color: T.ink }}>
          {BAND.emotional}
        </span>
      </div>
      <div style={{ ...col, borderLeft: `1px solid rgba(179,144,47,.35)`, paddingLeft: 28 }}>
        <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3 }}>{BAND.privacy}</span>
        <button
          type="button" onClick={onLearnMore}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
            fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.sienna,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          {BAND.link}
          <Icon name="arrow" size={15} strokeWidth={1.5} />
        </button>
      </div>
      <div style={{ ...col, borderLeft: `1px solid rgba(179,144,47,.35)`, paddingLeft: 28 }}>
        <span style={{ fontFamily: serif, fontSize: 15, color: T.ink2, letterSpacing: '.04em' }}>{BRAND}</span>
        <Eyebrow color={T.ink3}>{BRAND_SUB}</Eyebrow>
      </div>
    </footer>
  )
}

export default function ArchiveShell({
  active, role, creatorId, creatorName, portraitUrl, children, band = true, contentMax = 1180,
}: {
  active: SectionKey
  role: Role
  creatorId?: string
  creatorName: string
  portraitUrl?: string | null
  children: ReactNode
  band?: boolean
  contentMax?: number
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const items = navItems(role, cQuery)
  const firstName = creatorName.split(' ')[0] || creatorName

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: T.paper, color: T.ink }} className="archive-shell">
      {/* dark olive side navigation — atmosphere and privacy */}
      <nav
        className="archive-sidebar"
        style={{
          width: 244, flex: '0 0 244px', minHeight: '100dvh',
          background: `linear-gradient(184deg, ${T.oliveDeep} 0%, ${T.olive} 42%, #29221a 100%)`,
          borderRight: `1px solid rgba(20,15,11,.5)`,
          display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100dvh',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none', padding: '28px 26px 22px' , display: 'block' }}>
          <div style={{ fontFamily: serif, fontSize: 21, color: T.onDark, letterSpacing: '.01em' }}>{BRAND}</div>
          <div style={{ marginTop: 5 }}>
            <Eyebrow color="rgba(179,144,47,.85)">{BRAND_SUB}</Eyebrow>
          </div>
        </Link>

        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item) => {
            const isActive = item.key === active || location.pathname === item.to.split('?')[0]
            return (
              <Link
                key={item.key}
                to={item.to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '10px 12px', borderRadius: radius.sm, textDecoration: 'none',
                  fontFamily: sans, fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? T.onDark : 'rgba(240,231,214,.72)',
                  background: isActive ? 'rgba(240,231,214,.10)' : 'transparent',
                  boxShadow: isActive ? `inset 2px 0 0 ${T.sienna}` : 'none',
                }}
              >
                <Icon name={item.icon} size={18} color={isActive ? T.onDark : 'rgba(240,231,214,.6)'} />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div style={{ marginTop: 'auto', padding: 14 }}>
          <Divider tone="dark" style={{ marginBottom: 14 }} />
          <Link
            to={`/settings${cQuery}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '8px 12px',
              borderRadius: radius.sm, textDecoration: 'none',
            }}
          >
            {portraitUrl
              ? <img
                  src={portraitUrl} alt=""
                  style={{
                    width: 30, height: 30, borderRadius: radius.pill, objectFit: 'cover',
                    flex: '0 0 auto', border: `1px solid ${T.darkLine}`,
                  }}
                />
              : <Monogram name={creatorName} />}
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{
                fontFamily: sans, fontSize: 13.5, fontWeight: 600, color: T.onDark,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{firstName}’s Archive</span>
              <span style={{ fontFamily: sans, fontSize: 12, color: T.onDark3 }}>View profile</span>
            </span>
            <Icon name="arrow" size={15} color={T.onDark3} style={{ marginLeft: 'auto' }} />
          </Link>
        </div>
      </nav>

      {/* paper workspace */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: T.paper }}>
        <div style={{ flex: 1, background: paperTexture, backgroundColor: T.paper }}>
          <div style={{ maxWidth: contentMax, margin: '0 auto', padding: '38px 40px 46px' }}>
            {children}
          </div>
        </div>
        {band && <EditorialBand onLearnMore={() => navigate('/how-it-works')} />}
      </div>
    </div>
  )
}
