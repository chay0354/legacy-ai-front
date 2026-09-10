import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { T, radius, sans, serif } from '../design/tokens'
import { BAND, BRAND, BRAND_SUB, CTA, SITE_NAV } from '../design/copy'
import { Eyebrow, Icon } from '../design/ui'

export function SiteHeader({ onDark = true }: { onDark?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const fg = onDark ? T.onDark : T.ink
  const fg2 = onDark ? 'rgba(240,231,214,.74)' : T.ink2

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { setOpen(false) }, [location.pathname])

  const primaryTo = session ? '/overview' : '/signin?new=1'
  const primaryLabel = session ? 'Open archive' : CTA.begin

  return (
    <header className="site-header" style={{
      display: 'flex', alignItems: 'center', gap: 32,
      padding: '18px 44px', paddingTop: 'max(18px, env(safe-area-inset-top))',
      position: 'relative', zIndex: 3,
    }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <div style={{ fontFamily: serif, fontSize: 22, color: fg, letterSpacing: '.01em' }}>{BRAND}</div>
        <div style={{ marginTop: 4 }}>
          <Eyebrow color={onDark ? 'rgba(179,144,47,.85)' : T.ink3}>{BRAND_SUB}</Eyebrow>
        </div>
      </Link>

      <nav className="site-header-nav" style={{ display: 'flex', gap: 26, marginLeft: 'auto', marginRight: 8, alignItems: 'center' }}>
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

      <div className="site-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {!session && (
          <Link
            className="site-header-signin"
            to="/signin"
            style={{ fontFamily: sans, fontSize: 14.5, textDecoration: 'none', color: fg2 }}
          >{CTA.signIn}</Link>
        )}
        <button
          type="button"
          className="site-header-cta"
          onClick={() => navigate(primaryTo)}
          style={{
            background: T.sienna, color: '#fdf8ef', border: 'none', borderRadius: radius.sm,
            padding: '11px 20px', fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >{primaryLabel}</button>
      </div>

      <button
        type="button"
        className="site-header-menu-btn"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'none', background: 'none', border: `1px solid ${onDark ? T.darkLine : T.line}`,
          color: fg, borderRadius: radius.sm, padding: '8px 12px', fontFamily: sans, fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}
      >{open ? 'Close' : 'Menu'}</button>

      {open && (
        <div className="site-header-drawer" style={{
          position: 'absolute', left: 0, right: 0, top: '100%',
          background: T.walnutDeep, borderTop: `1px solid ${T.darkLine}`,
          padding: '18px 24px 28px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {SITE_NAV.map((item) => (
            <Link
              key={item.to} to={item.to}
              style={{
                fontFamily: sans, fontSize: 17, textDecoration: 'none',
                color: location.pathname === item.to ? T.onDark : 'rgba(240,231,214,.74)',
                fontWeight: location.pathname === item.to ? 600 : 400,
              }}
            >{item.label}</Link>
          ))}
          {!session && (
            <Link to="/signin" style={{ fontFamily: sans, fontSize: 17, textDecoration: 'none', color: 'rgba(240,231,214,.74)' }}>
              {CTA.signIn}
            </Link>
          )}
          <button
            type="button"
            onClick={() => navigate(primaryTo)}
            style={{
              background: T.sienna, color: '#fdf8ef', border: 'none', borderRadius: radius.sm,
              padding: '12px 18px', fontFamily: sans, fontSize: 15, fontWeight: 600, cursor: 'pointer',
              width: '100%',
            }}
          >{primaryLabel}</button>
        </div>
      )}
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
    <footer className="site-footer" style={{ background: T.walnut, padding: '48px 44px 38px' }}>
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
  children, headerOnDark = true,
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
