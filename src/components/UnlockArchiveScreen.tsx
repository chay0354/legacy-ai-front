import PaywallCard from './PaywallCard'
import { SitePage } from '../site/SiteChrome'
import { Body, Display, Eyebrow } from '../design/ui'
import { T } from '../design/tokens'

export default function UnlockArchiveScreen() {
  return (
    <SitePage>
      <div style={{
        maxWidth: 640, margin: '0 auto', padding: '72px 28px 96px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <Eyebrow>Preserve</Eyebrow>
        <Display size={36}>Your interview is kept. The archive opens when you pay.</Display>
        <Body size={16} color={T.ink2}>
          We saved what you recorded. Stories, people, values, and the live avatar stay closed
          on Preserve. Choose Monthly or Set up to see everything.
        </Body>
        <PaywallCard
          kind="unlock"
          title="Pay to see your data"
          note="Monthly includes 60 minutes each month. Set up includes the first three months."
        />
      </div>
    </SitePage>
  )
}
