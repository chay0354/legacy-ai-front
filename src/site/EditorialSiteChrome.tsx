import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import logo from '../assets/homepage/logo-cream.svg'
import './HomePage.css'
import './EditorialPages.css'

/** Preview shell uses the approved homepage palette, fonts, navigation and footer. */
export function EditorialSitePage({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const header = useRef<HTMLElement>(null)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setMenuOpen(false)
    }
    const closeOnResize = () => { if (window.innerWidth > 850) setMenuOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOutside)
    window.addEventListener('resize', closeOnResize)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('resize', closeOnResize)
    }
  }, [menuOpen])

  const beginTo = session ? '/overview' : '/signin?new=1'
  return (
    <div className="as-told-home editorial-page">
      <a className="skip" href="#editorial-main">Skip to content</a>
      <div className="site-header-surface">
      <header className="header" ref={header}>
        <Link className="brand" to="/" aria-label="As Told home"><img src={logo} width="78" height="66" alt="As Told" /></Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <NavLink to="/about">About</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/the-archive">The Archive</NavLink>
          <NavLink to="/pricing">Pricing</NavLink>
        </nav>
        <div className="header-actions">{!session && <Link className="signin" to="/signin">Sign in</Link>}<Link className="header-cta" to={beginTo}>{session ? 'Open archive' : 'Begin your archive'}</Link></div>
        <button className="menu-toggle" type="button" ref={menuButton} aria-expanded={menuOpen} aria-controls="editorial-mobile-menu" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? 'Close' : 'Menu'} <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
        <nav id="editorial-mobile-menu" className="mobile-menu" aria-label="Mobile navigation" hidden={!menuOpen} onClick={() => setMenuOpen(false)}>
          <NavLink to="/about">About</NavLink><NavLink to="/how-it-works">How it works</NavLink><NavLink to="/the-archive">The Archive</NavLink><NavLink to="/pricing">Pricing</NavLink><Link to={session ? '/overview' : '/signin'}>{session ? 'Open archive' : 'Sign in'}</Link>
        </nav>
      </header>
      </div>
      <main id="editorial-main" tabIndex={-1}>{children}</main>
  <footer className="home-footer">
    <div className="footer-grid">
      <div className="footer-brand"><img src={logo} width="66" height="56" alt="As Told" /><p className="eyebrow">Private family archive</p><p>Your stories, voice, and memories, kept with care.</p></div>
      <nav aria-label="Product footer navigation"><h2 className="eyebrow">The product</h2><Link to="/how-it-works">How it works</Link><Link to="/the-archive">The Archive</Link><Link to="/pricing">Pricing</Link></nav>
      <nav aria-label="Company footer navigation"><h2 className="eyebrow">The company</h2><Link to="/about">About</Link><Link to="/about#privacy">Security &amp; privacy</Link><Link to={session ? '/overview' : '/signin'}>{session ? 'Open archive' : 'Sign in'}</Link></nav>
      <div className="footer-story"><p>Every story you add now gives your family something real to return to.</p><Link className="text-link" to="/how-it-works">Learn how the archive is built</Link></div>
    </div>
    <div className="footer-bottom"><p>Built privately. Shared only with the people you choose.</p><p>© {new Date().getFullYear()} As Told</p></div>
  </footer>
    </div>
  )
}
