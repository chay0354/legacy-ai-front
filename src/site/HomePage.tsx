import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import heroPhoto from '../assets/homepage/hero-original-reframed-c.webp'
import keepsakePhoto from '../assets/homepage/keepsake.webp'
import closingPhoto from '../assets/homepage/closing-family-table-v2.webp'
import logo from '../assets/homepage/logo-cream.svg'
import './HomePage.css'

/** Approved homepage; its styles are isolated from the other product screens. */
export default function HomePage() {
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
    <div className="as-told-home">

  <a className="skip" href="#home-main">Skip to content</a>
  <main id="home-main" tabIndex={-1}>
    <section className="hero" aria-labelledby="hero-title">
      <img className="hero-photo" src={heroPhoto} alt="Illustrative mother and daughter decorating a cake, viewed from behind in a sunlit kitchen." fetchPriority="high" width="1536" height="1024" />
      <div className="hero-shade" aria-hidden="true"></div>
      <div className="site-header-surface">
      <header className="header" ref={header}>
        <Link className="brand" to="/" aria-label="As Told home"><img src={logo} width="78" height="66" alt="As Told" /></Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link to="/about">About</Link>
          <Link to="/how-it-works">How it works</Link>
          <Link to="/the-archive">The Archive</Link>
          <Link to="/pricing">Pricing</Link>
        </nav>
        <div className="header-actions">{!session && <Link className="signin" to="/signin">Sign in</Link>}<Link className="header-cta" to={beginTo}>{session ? 'Open archive' : 'Begin your archive'}</Link></div>
        <button className="menu-toggle" type="button" ref={menuButton} aria-expanded={menuOpen} aria-controls="home-mobile-menu" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? 'Close' : 'Menu'} <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
        <nav id="home-mobile-menu" className="mobile-menu" aria-label="Mobile navigation" hidden={!menuOpen} onClick={() => setMenuOpen(false)}>
          <Link to="/about">About</Link><Link to="/how-it-works">How it works</Link><Link to="/the-archive">The Archive</Link><Link to="/pricing">Pricing</Link><Link to={session ? '/overview' : '/signin'}>{session ? 'Open archive' : 'Sign in'}</Link>
        </nav>
      </header>
      </div>
      <div className="hero-copy">
        <h1 id="hero-title">Gather your<br /> stories.<br /><em>Keep them close.</em></h1>
        <p className="hero-intro">Record your voice. Add your memories.<br className="desktop-break" /> Keep your stories for the people you choose.</p>
        <div className="hero-actions"><Link className="primary" to={beginTo}>Begin your archive</Link><Link className="text-link" to="/how-it-works">Learn how it works</Link></div>
        <p className="privacy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg><span>Private by default. Shared only with the people you choose.</span></p>
      </div>
    </section>

    <section id="conversation" className="conversation" aria-labelledby="conversation-title">
      <div className="conversation-copy">
        <p className="eyebrow">A guided conversation</p>
        <h2 id="conversation-title">Record the stories<br className="wide-break" /> your family will<br className="wide-break" /> one day ask for.</h2>
        <p>You answer questions at your own pace — out loud or in writing. What you share becomes a private archive of your words, your voice, and the people who matter to you.</p>
        <p>Nothing is public. Nothing leaves your archive unless you invite someone into it.</p>
      </div>
      <figure><img loading="lazy" decoding="async" src={keepsakePhoto} alt="Illustrative photograph of hands holding a family beach snapshot." width="1448" height="1086" /></figure>
    </section>

    <section id="your-pace" className="steps" aria-label="How the archive is built">
      <div className="step-grid">
        <article><span className="number">01</span><h3>Begin with a guided conversation</h3><p>An interview that asks the questions your family would ask, one at a time, at your pace.</p></article>
        <article><span className="number">02</span><h3>Add voice, photos, and family context</h3><p>Record a voice memory. Add photographs, letters, and the people who belong to each story.</p></article>
        <article><span className="number">03</span><h3>Review and shape the archive</h3><p>Every entry stays yours to edit. Correct a date, add what you left out, remove what you would rather not keep.</p></article>
      </div>
      <Link className="text-link steps-action" to="/how-it-works">See how the archive is built</Link>
    </section>

    <section id="trust" className="trust" aria-labelledby="trust-title">
      <div className="trust-copy">
        <p className="eyebrow">Trust</p>
        <h2 id="trust-title">Some stories deserve to be kept in their own words.</h2>
        <p>The archive holds only what you put into it. It answers from your recorded material, and when it does not know something, it says so.</p>
      </div>
      <ul className="trust-list">
        <li>Private by default</li>
        <li>Shared only with invited family</li>
        <li>Built only from what you choose to share</li>
        <li>If the archive does not know, it says so.</li>
        <li>Voice and likeness require explicit permission</li>
      </ul>
    </section>

    <section className="closing closing-photographic" aria-labelledby="closing-title">
      <figure className="closing-photo"><img loading="lazy" decoding="async" src={closingPhoto} width="1254" height="1254" alt="Illustrative family snapshot of parents and children sharing sandwiches and laughter around a kitchen table." /></figure>
      <div className="closing-copy">
        <h2 id="closing-title">Build the archive your family can return to.</h2>
        <p>Start with one conversation. Add a voice memory when you feel like it. Invite the people you choose, when you are ready.</p>
        <div className="closing-actions"><Link className="primary" to={beginTo}>Start with a guided interview</Link><Link className="text-link" to="/pricing">Pricing</Link></div>
        <details className="closing-details">
          <summary>What you end up with</summary>
          <ul>
            <li>Stories in your own words</li>
            <li>Voice memories, kept as recordings</li>
            <li>Photographs and documents in context</li>
            <li>The people who belong to each story</li>
            <li>Family access you control</li>
          </ul>
        </details>
      </div>
    </section>
  </main>
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
