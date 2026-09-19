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
        <Eyebrow>Archive locked</Eyebrow>
        <Display size={36}>Your interview is kept. The archive opens when you continue.</Display>
        <Body size={16} color={T.ink2}>
          We saved what you recorded. Stories, people, values, and the live avatar stay closed
          until you choose Monthly or Storage.
        </Body>
        <PaywallCard
          kind="unlock"
          title="Open the archive"
          note="Monthly includes 60 interview minutes each month. Storage keeps the stored archive active without new interviews."
        />
      </div>
    </SitePage>
  )
}
