import type { CSSProperties, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { T, paperTexture, radius, sans, serif } from '../../design/tokens'
import { BAND, BRAND, BRAND_SUB, NAV } from '../../design/copy'
import { Divider, Eyebrow, Icon } from '../../design/ui'
import type { Role } from '../../lib/api'
import {
  canEditArchive, canManageAccess, canRunInterview, sectionsForRole, type SectionKey,
} from './sections'

export type ArchiveRouteKey = 'edit' | 'settings' | 'access' | 'ask'

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
  const rule = '1px solid rgba(179,144,47,.35)'
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
      <div style={{ ...col, borderLeft: rule, paddingLeft: 28 }}>
        <span style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.4, color: T.ink }}>
          {BAND.emotional}
        </span>
      </div>
      <div style={{ ...col, borderLeft: rule, paddingLeft: 28 }}>
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
      <div style={{ ...col, borderLeft: rule, paddingLeft: 28 }}>
        <span style={{ fontFamily: serif, fontSize: 15, color: T.ink2, letterSpacing: '.04em' }}>{BRAND}</span>
        <Eyebrow color={T.ink3}>{BRAND_SUB}</Eyebrow>
      </div>
    </footer>
  )
}

/**
 * The archive shell. The side navigation is an index of the ONE main screen:
 * each item scrolls to its band. Route links (interview, family access,
 * settings) sit below a divider, and every item is gated by role.
 */
export default function ArchiveShell({
  role, creatorId, creatorName, portraitUrl, children,
  activeSection, onSection, activeRoute, band = true, contentMax = 1180,
}: {
  role: Role
  creatorId?: string
  creatorName: string
  portraitUrl?: string | null
  children: ReactNode
  /** Highlighted band on the main screen (scroll spy). Undefined when off it. */
  activeSection?: SectionKey
  onSection: (key: SectionKey) => void
  activeRoute?: ArchiveRouteKey
  band?: boolean
  contentMax?: number
}) {
  const navigate = useNavigate()
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const sections = sectionsForRole(role).filter((s) => s.inNav)
  const firstName = creatorName.split(' ')[0] || creatorName
  const mayEdit = canEditArchive(role)
  // A member has no setup band, so fall back to the first band they can see.
  const readingBand = sections.some((s) => s.key === activeSection)
    ? activeSection
    : sections[0]?.key

  const itemStyle = (active: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
    padding: '9px 12px', borderRadius: radius.sm, textDecoration: 'none',
    background: active ? 'rgba(240,231,214,.10)' : 'transparent',
    boxShadow: active ? `inset 2px 0 0 ${T.sienna}` : 'none',
    fontFamily: sans, fontSize: 14, fontWeight: active ? 600 : 400,
    color: active ? T.onDark : 'rgba(240,231,214,.72)',
    border: 'none', cursor: 'pointer', textAlign: 'left',
    transition: 'background .18s ease, color .18s ease',
  })

  const iconColor = (active: boolean) => (active ? T.onDark : 'rgba(240,231,214,.6)')

  return (
    <div className="archive-shell" style={{
      minHeight: '100dvh', display: 'flex', background: T.paper, color: T.ink,
    }}>
      <nav
        className="archive-sidebar"
        style={{
          width: 244, flex: '0 0 244px',
          background: `linear-gradient(184deg, ${T.oliveDeep} 0%, ${T.olive} 42%, #29221a 100%)`,
          borderRight: '1px solid rgba(20,15,11,.5)',
          display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100dvh',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none', padding: '26px 26px 18px', display: 'block' }}>
          <div style={{ fontFamily: serif, fontSize: 21, color: T.onDark, letterSpacing: '.01em' }}>{BRAND}</div>
          <div style={{ marginTop: 5 }}>
            <Eyebrow color="rgba(179,144,47,.85)">{BRAND_SUB}</Eyebrow>
          </div>
        </Link>

        <div style={{ padding: '0 26px 6px' }}>
          <Eyebrow color={T.onDark3}>In this archive</Eyebrow>
        </div>

        <div className="archive-nav-scroll" style={{
          padding: '6px 14px 0', display: 'flex', flexDirection: 'column', gap: 2,
          overflowY: 'auto', overscrollBehavior: 'contain',
        }}>
          {sections.map((s) => {
            const active = !activeRoute && readingBand === s.key
            return (
              <button
                key={s.key} type="button" onClick={() => onSection(s.key)}
                style={itemStyle(active)}
              >
                <Icon name={s.icon} size={18} color={iconColor(active)} />
                {s.label}
              </button>
            )
          })}
        </div>

        <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Divider tone="dark" style={{ margin: '0 12px 12px' }} />
          {canRunInterview(role) && (
            <Link to="/interview" style={itemStyle(false)}>
              <Icon name="interview" size={18} color={iconColor(false)} />
              {NAV.interview}
            </Link>
          )}
          {canManageAccess(role) && (
            <Link to={`/family-access${cQuery}`} style={itemStyle(activeRoute === 'access')}>
              <Icon name="lock" size={18} color={iconColor(activeRoute === 'access')} />
              {NAV.access}
            </Link>
          )}
          <Link to={`/settings${cQuery}`} style={itemStyle(activeRoute === 'settings')}>
            <Icon name="settings" size={18} color={iconColor(activeRoute === 'settings')} />
            {NAV.settings}
          </Link>
        </div>

        {/* bottom-left archive identity — the owner's way into the edit surface */}
        <div style={{ marginTop: 'auto', padding: 14 }}>
          <Divider tone="dark" style={{ marginBottom: 14 }} />
          {mayEdit ? (
            <Link
              to={`/edit${cQuery}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px',
                borderRadius: radius.sm, textDecoration: 'none',
                background: activeRoute === 'edit' ? 'rgba(240,231,214,.10)' : 'rgba(240,231,214,.05)',
                border: `1px solid ${T.darkLine}`,
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
                <span style={{ fontFamily: sans, fontSize: 12, color: 'rgba(179,144,47,.9)' }}>
                  Edit archive
                </span>
              </span>
              <Icon name="pen" size={15} color={T.onDark3} style={{ marginLeft: 'auto' }} />
            </Link>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px' }}>
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
                <span style={{ fontFamily: sans, fontSize: 12, color: T.onDark3 }}>
                  {canManageAccess(role) ? 'You help look after this' : 'Shared with you'}
                </span>
              </span>
            </div>
          )}
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
