import { useNavigate } from 'react-router-dom'
import { SiteFooter, SiteHeader } from './SiteChrome'
import { T, radius, sans, serif } from '../design/tokens'
import { CTA, HERO, HOW_IT_WORKS, TRUST } from '../design/copy'
import { Body, Btn, Display, Divider, Eyebrow, Icon, Panel } from '../design/ui'

export default function HomePage() {
  const navigate = useNavigate()
  const begin = () => navigate('/signin?new=1')

  return (
    <div style={{ minHeight: '100dvh', background: T.paper, display: 'flex', flexDirection: 'column' }}>
      {/* ── atmospheric hero: a room, not a black panel ── */}
      <section style={{ position: 'relative', background: T.walnutDeep, overflow: 'hidden' }}>
        {/* Hero photograph goes here — see HANDOFF.md. Until then: a warm room, lit from the right. */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(120% 90% at 82% 34%, rgba(176,94,55,.30) 0%, rgba(94,60,38,.22) 38%, rgba(24,18,13,0) 72%),
            radial-gradient(70% 60% at 96% 76%, rgba(179,144,47,.18) 0%, rgba(24,18,13,0) 70%),
            linear-gradient(100deg, #17110c 0%, #241a13 46%, #33251b 100%)`,
        }} />
        <div style={{ position: 'relative' }}>
          <SiteHeader />
          <div style={{ padding: '72px 44px 88px', maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 22 }}>
              <Eyebrow color="rgba(179,144,47,.9)">{HERO.standfirst}</Eyebrow>
              <h1 style={{
                fontFamily: serif, fontWeight: 400, fontSize: 66, lineHeight: 1.03,
                letterSpacing: '-.02em', color: T.onDark, margin: 0, textWrap: 'balance',
              }}>
                {HERO.headline[0]}
                <br />
                <em style={{ fontStyle: 'italic', fontWeight: 400 }}>{HERO.headline[1]}</em>
              </h1>
              <p style={{
                fontFamily: sans, fontSize: 18, lineHeight: 1.6, color: 'rgba(240,231,214,.82)',
                margin: 0, maxWidth: 460, textWrap: 'pretty',
              }}>{HERO.sub}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                <Btn size="lg" onClick={begin}>{CTA.begin}</Btn>
                <Btn size="lg" tone="onDark" onClick={() => navigate('/how-it-works')}>{CTA.learn}</Btn>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8,
                fontFamily: sans, fontSize: 13.5, color: 'rgba(240,231,214,.55)',
              }}>
                <Icon name="lock" size={15} color="rgba(240,231,214,.5)" strokeWidth={1.3} />
                Private by default. Shared only with the people you choose.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── paper explanation ── */}
      <section style={{ background: T.paper, padding: '76px 44px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Eyebrow>A guided conversation</Eyebrow>
            <Display size={40}>
              Record the stories your family will one day ask for.
            </Display>
            <Body size={17} style={{ maxWidth: 620 }}>
              You answer questions at your own pace — out loud or in writing. What you share becomes
              a private archive of your words, your voice, and the people who matter to you. Nothing
              is public. Nothing leaves your archive unless you invite someone into it.
            </Body>
          </div>

          <div style={{
            marginTop: 46, display: 'grid', gap: 1, background: T.line,
            border: `1px solid ${T.line}`, borderRadius: radius.md, overflow: 'hidden',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          }}>
            {HOW_IT_WORKS.slice(0, 3).map((s) => (
              <div key={s.n} style={{
                background: T.card, padding: '26px 24px 28px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <span style={{ fontFamily: serif, fontSize: 15, color: T.gold, letterSpacing: '.1em' }}>{s.n}</span>
                <span style={{ fontFamily: serif, fontSize: 21, lineHeight: 1.25, color: T.ink }}>{s.title}</span>
                <Body size={14}>{s.body}</Body>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 26 }}>
            <Btn tone="quiet" onClick={() => navigate('/how-it-works')}>{CTA.seeBuilt}</Btn>
          </div>
        </div>
      </section>

      {/* ── walnut trust band: the room ── */}
      <section style={{ background: T.walnut, padding: '72px 44px' }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 48,
          gridTemplateColumns: 'minmax(280px, .9fr) minmax(320px, 1.1fr)', alignItems: 'start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Eyebrow color="rgba(179,144,47,.9)">Trust</Eyebrow>
            <Display size={34} color={T.onDark}>
              Some stories deserve to be kept in their own words.
            </Display>
            <Body size={16} color={T.onDark2} style={{ maxWidth: 420 }}>
              The archive holds only what you put into it. It answers from your recorded material,
              and when it does not know something, it says so.
            </Body>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {TRUST.map((line, i) => (
              <div key={line} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '17px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${T.darkLine}`,
              }}>
                <Icon name="check" size={17} color="rgba(179,144,47,.9)" strokeWidth={1.4} />
                <span style={{ fontFamily: sans, fontSize: 16, color: T.onDark }}>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── quiet close ── */}
      <section style={{ background: T.paper, padding: '76px 44px 84px' }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 40,
          gridTemplateColumns: 'minmax(300px, 1.1fr) minmax(260px, .8fr)', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Display size={38}>Build the archive your family can return to.</Display>
            <Body size={16.5} style={{ maxWidth: 520 }}>
              Start with one conversation. Add a voice memory when you feel like it. Invite the
              people you choose, when you are ready.
            </Body>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Btn size="lg" onClick={begin}>{CTA.guided}</Btn>
              <Btn size="lg" tone="quiet" onClick={() => navigate('/pricing')}>Pricing</Btn>
            </div>
          </div>
          <Panel pad="24px 26px" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Eyebrow>What you end up with</Eyebrow>
            <Divider tone="gold" />
            {[
              'Stories in your own words',
              'Voice memories, kept as recordings',
              'Photographs and documents in context',
              'The people who belong to each story',
              'Family access you control',
            ].map((line) => (
              <span key={line} style={{
                fontFamily: sans, fontSize: 14.5, color: T.ink2,
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <Icon name="check" size={15} color={T.olive} strokeWidth={1.4} />
                {line}
              </span>
            ))}
          </Panel>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
