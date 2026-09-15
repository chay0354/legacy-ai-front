import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { accessApi, billingApi, type BillingStatus } from '../lib/api'
import { SitePage } from './SiteChrome'
import { Body, Btn, Display, Eyebrow } from '../design/ui'
import { T } from '../design/tokens'

type Phase = 'confirming' | 'ready' | 'failed'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function BillingSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = params.get('session_id') || ''
  const [phase, setPhase] = useState<Phase>('confirming')
  const [error, setError] = useState<string | null>(null)
  const [hasArchive, setHasArchive] = useState(false)
  const ran = useRef(false)

  const finishReady = useCallback(async (_billing: BillingStatus) => {
    setPhase('ready')
    const me = await accessApi.me().catch(() => null)
    setHasArchive(Boolean(me?.memberships.some((m) => (
      m.isOwner && ((m.avatarLevel ?? 0) > 0 || (m.completionScore ?? 0) > 0)
    ))))
  }, [])

  const confirm = useCallback(async () => {
    setPhase('confirming')
    setError(null)
    if (!sessionId) {
      setError('This link is missing its checkout reference.')
      setPhase('failed')
      return
    }

    let lastError: string | null = null
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const billing = await billingApi.sync(sessionId)
        if (billing.paid) {
          await finishReady(billing)
          return
        }
        lastError = null
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Could not confirm the payment'
      }
      await sleep(attempt === 0 ? 400 : 1200)
    }

    try {
      const status = await billingApi.status()
      if (status.paid) {
        await finishReady(status)
        return
      }
    } catch { /* keep the last sync error */ }

    setError(lastError || 'Payment is recorded at Stripe, but the plan has not opened yet. Try once more.')
    setPhase('failed')
  }, [sessionId, finishReady])

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    void confirm()
  }, [confirm])

  const title = phase === 'ready'
    ? (hasArchive ? 'Your plan is active.' : 'Your archive is open.')
    : phase === 'confirming' ? 'Opening your plan…'
      : 'We could not confirm the payment.'

  const note = phase === 'ready'
    ? (hasArchive
      ? 'Everything you had stays where it was. Family you invite never pays separately.'
      : 'The interview is ready when you are — about twenty minutes for the first sitting. Family you invite never pays separately.')
    : phase === 'confirming'
      ? 'Stripe has the payment. We are opening the archive now.'
      : 'If you were charged, press try again. You will not be charged twice.'

  return (
    <SitePage>
      <div style={{
        maxWidth: 640, margin: '0 auto', padding: '72px 28px 96px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <Eyebrow>Billing</Eyebrow>
        <Display size={38}>{title}</Display>
        <Body size={16} color={T.ink2}>{note}</Body>
        {error && <Body size={14} color={T.siennaDeep}>{error}</Body>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          {phase === 'ready' && (hasArchive ? (
            <>
              <Btn onClick={() => navigate('/overview')}>Open your archive</Btn>
              <Btn tone="quiet" onClick={() => navigate('/interview')}>Continue the interview</Btn>
            </>
          ) : (
            <>
              <Btn onClick={() => navigate('/interview')}>Begin your interview</Btn>
              <Btn tone="quiet" onClick={() => navigate('/overview')}>Look around first</Btn>
            </>
          ))}
          {phase === 'failed' && (
            <>
              <Btn onClick={() => void confirm()}>Try again</Btn>
              <Btn tone="quiet" onClick={() => navigate('/pricing')}>See your plan</Btn>
            </>
          )}
        </div>
      </div>
    </SitePage>
  )
}
