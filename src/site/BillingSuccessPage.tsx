import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { billingApi } from '../lib/api'
import { SitePage } from './SiteChrome'
import { Body, Btn, Display, Eyebrow } from '../design/ui'
import { T } from '../design/tokens'

type Phase = 'confirming' | 'ready' | 'failed'

export default function BillingSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = params.get('session_id') || ''
  const [phase, setPhase] = useState<Phase>('confirming')
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    if (!sessionId) {
      setError('This link is missing its checkout reference.')
      setPhase('failed')
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setError('This is taking too long. Try again — you will not be charged twice.')
        setPhase('failed')
      }
    }, 12000)

    billingApi.sync(sessionId)
      .then((billing) => {
        if (cancelled) return
        if (billing.paid) {
          window.clearTimeout(timer)
          setPhase('ready')
          const boughtAddon = params.get('addon') === '1'
          navigate(boughtAddon ? '/settings' : '/interview', { replace: true })
          return
        }
        setError('Payment is at Stripe, but the plan did not open. Try again.')
        setPhase('failed')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not confirm the payment')
        setPhase('failed')
      })
      .finally(() => window.clearTimeout(timer))

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [sessionId, navigate])

  return (
    <SitePage>
      <div style={{
        maxWidth: 640, margin: '0 auto', padding: '72px 28px 96px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <Eyebrow>Billing</Eyebrow>
        <Display size={38}>
          {phase === 'ready' ? 'Your plan is open.'
            : phase === 'confirming' ? 'Opening your plan…'
              : 'We could not open the plan.'}
        </Display>
        <Body size={16} color={T.ink2}>
          {phase === 'ready'
            ? (params.get('addon') === '1' ? 'Those minutes are on your plan.' : 'Taking you through.')
            : phase === 'confirming' ? 'This should only take a moment.'
              : 'If you were charged, try again. You will not be charged twice.'}
        </Body>
        {error && <Body size={14} color={T.siennaDeep}>{error}</Body>}
        {phase === 'failed' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <Btn onClick={() => window.location.reload()}>Try again</Btn>
            <Btn tone="quiet" onClick={() => navigate('/interview')}>Go to the interview</Btn>
          </div>
        )}
      </div>
    </SitePage>
  )
}
