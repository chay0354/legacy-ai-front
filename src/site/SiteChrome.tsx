import type { CSSProperties, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { T, radius, sans, serif } from '../design/tokens'
import { BAND, BRAND, BRAND_SUB, CTA, SITE_NAV } from '../design/copy'
import { Eyebrow, Icon } from '../design/ui'

export function SiteHeader({ onDark = true }: { onDark?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const fg = onDark ? T.onDark : T.ink
  const fg2 = onDark ? 'rgba(240,231,214,.74)' : T.ink2

  return (
    <header className="site-header" style={{
      display: 'flex', alignItems: 'center', gap: 32,
      padding: '22px 44px', position: 'relative', zIndex: 3,
    }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <div style={{ fontFamily: serif, fontSize: 22, color: fg, letterSpacing: '.01em' }}>{BRAND}</div>
        <div style={{ marginTop: 4 }}>
          <Eyebrow color={onDark ? 'rgba(179,144,47,.85)' : T.ink3}>{BRAND_SUB}</Eyebrow>
        </div>
      </Link>

      <nav className="site-header-nav" style={{ display: 'flex', gap: 26, marginLeft: 'auto', alignItems: 'center' }}>
        {SITE_NAV.map((item) => {
          const active = location.pathname === item.to
          return (
            <Link
              key={item.to} to={item.to}
              style={{
                fontFamily: sans, fontSize: 14.5, textDecoration: 'none',
                color: active ? fg : fg2, fontWeight: active ? 600 : 400,
                paddingBottom: 2,
                borderBottom: active ? `1px solid ${T.gold}` : '1px solid transparent',
              }}
            >{item.label}</Link>
          )
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link
          to="/signin"
          style={{ fontFamily: sans, fontSize: 14.5, textDecoration: 'none', color: fg2 }}
        >{CTA.signIn}</Link>
        <button
          type="button"
          onClick={() => navigate('/signin?new=1')}
          style={{
            background: T.sienna, color: '#fdf8ef', border: 'none', borderRadius: radius.sm,
            padding: '11px 20px', fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >{CTA.begin}</button>
      </div>
    </header>
  )
}

/** Walnut editorial footer — structured columns, quiet dividers, no ornament. */
export function SiteFooter() {
  const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }
  const link: CSSProperties = {
    fontFamily: sans, fontSize: 14, color: 'rgba(240,231,214,.70)', textDecoration: 'none',
  }
  return (
    <footer style={{ background: T.walnut, padding: '48px 44px 38px' }}>
      <div className="site-footer-grid" style={{
        display: 'grid', gap: 44, maxWidth: 1280, margin: '0 auto',
        gridTemplateColumns: 'minmax(220px,1.2fr) minmax(160px,.7fr) minmax(160px,.7fr) minmax(240px,1fr)',
      }}>
        <div style={col}>
          <div style={{ fontFamily: serif, fontSize: 21, color: T.onDark }}>{BRAND}</div>
          <Eyebrow color="rgba(179,144,47,.85)">{BAND.eyebrow}</Eyebrow>
          <span style={{ fontFamily: sans, fontSize: 14, color: 'rgba(240,231,214,.62)', lineHeight: 1.6 }}>
            {BAND.line}
          </span>
        </div>
        <div style={{ ...col, borderLeft: `1px solid ${T.darkLine}`, paddingLeft: 30 }}>
          <Eyebrow color={T.onDark3}>The product</Eyebrow>
          <Link to="/how-it-works" style={link}>How it works</Link>
          <Link to="/the-archive" style={link}>The Archive</Link>
          <Link to="/pricing" style={link}>Pricing</Link>
        </div>
        <div style={{ ...col, borderLeft: `1px solid ${T.darkLine}`, paddingLeft: 30 }}>
          <Eyebrow color={T.onDark3}>The company</Eyebrow>
          <Link to="/about" style={link}>About</Link>
          <Link to="/about#privacy" style={link}>Security & privacy</Link>
          <Link to="/signin" style={link}>Sign in</Link>
        </div>
        <div style={{ ...col, borderLeft: `1px solid ${T.darkLine}`, paddingLeft: 30 }}>
          <span style={{ fontFamily: serif, fontSize: 18, color: T.onDark, lineHeight: 1.45 }}>
            {BAND.emotional}
          </span>
          <Link
            to="/how-it-works"
            style={{
              fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.sienna,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            {BAND.link}
            <Icon name="arrow" size={15} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
      <div style={{
        maxWidth: 1280, margin: '34px auto 0', paddingTop: 18,
        borderTop: `1px solid ${T.darkLine}`, display: 'flex',
        justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: sans, fontSize: 13, color: T.onDark3 }}>{BAND.privacy}</span>
        <span style={{ fontFamily: sans, fontSize: 13, color: T.onDark3 }}>© {new Date().getFullYear()} {BRAND}</span>
      </div>
    </footer>
  )
}

export function SitePage({
  children, headerOnDark = false,
}: { children: ReactNode; headerOnDark?: boolean }) {
  return (
    <div style={{ minHeight: '100dvh', background: T.paper, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: headerOnDark ? T.walnut : T.paper }}>
        <SiteHeader onDark={headerOnDark} />
      </div>
      <main style={{ flex: 1 }}>{children}</main>
      <SiteFooter />
    </div>
  )
}
