import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { accessApi, billingApi } from '../lib/api'
import { SitePage } from './SiteChrome'
import { Body, Btn, Display, Eyebrow } from '../design/ui'
import { T } from '../design/tokens'

type Phase = 'confirming' | 'ready' | 'pending' | 'failed'

export default function BillingSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = params.get('session_id') || ''
  const [phase, setPhase] = useState<Phase>('confirming')
  const [error, setError] = useState<string | null>(null)
  /** A first-time payer has nothing to open yet — the interview is the real next step. */
  const [hasArchive, setHasArchive] = useState(false)

  const confirm = useCallback(async () => {
    setPhase('confirming')
    setError(null)
    try {
      const billing = await billingApi.sync(sessionId)
      if (!billing.paid) {
        setPhase('pending')
        return
      }
      setPhase('ready')
      const me = await accessApi.me().catch(() => null)
      setHasArchive(Boolean(me?.memberships.some((m) => (
        m.isOwner && ((m.avatarLevel ?? 0) > 0 || (m.completionScore ?? 0) > 0)
      ))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm the payment')
      setPhase('failed')
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) {
      setError('This link is missing its checkout reference. Open Settings to see your plan.')
      setPhase('failed')
      return
    }
    void confirm()
  }, [sessionId, confirm])

  const title = phase === 'ready'
    ? (hasArchive ? 'Your plan is active.' : 'Your archive is open.')
    : phase === 'confirming' ? 'Confirming your plan…'
      : phase === 'pending' ? 'Stripe is still confirming.'
        : 'We could not confirm the payment.'

  const note = phase === 'ready'
    ? (hasArchive
      ? 'Everything you had stays where it was. Family you invite never pays separately.'
      : 'The interview is ready when you are — about twenty minutes for the first sitting. Family you invite never pays separately.')
    : phase === 'confirming' ? 'This usually takes a few seconds.'
      : phase === 'pending' ? 'The payment went through but the subscription has not landed yet. Check again in a moment — nothing is lost either way.'
        : 'If you were charged, your plan will show up on the pricing page within a minute. You will not be charged twice.'

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
          {(phase === 'pending' || phase === 'failed') && (
            <>
              <Btn onClick={() => void confirm()}>Check again</Btn>
              <Btn tone="quiet" onClick={() => navigate('/pricing')}>See your plan</Btn>
            </>
          )}
        </div>
      </div>
    </SitePage>
  )
}
