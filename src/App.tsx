import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams,
} from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import {
  accessApi,
  clearAuthTokenCache,
  interviewApi,
  isAuthError,
  type AccessMe,
  type InterviewSessionData,
  type Role,
  type CompleteResult,
} from './lib/api'
import { browserStt, browserTts } from './lib/voice'
import { checkAiVoiceAvailable } from './lib/openaiRealtimeInterview'
import InterviewSession, { type Answer } from './components/InterviewSession'
import RequireAction from './components/archive/RequireAction'
import { ACTIONS, can, normalizeRole } from './lib/permissions'

import HomePage from './site/HomePage'
import { AboutPage, HowItWorksPage, PricingPage, TheArchivePage } from './site/InfoPages'
import BillingSuccessPage from './site/BillingSuccessPage'
import AdminPage from './site/AdminPage'
import PaywallCard from './components/PaywallCard'
import UnlockArchiveScreen from './components/UnlockArchiveScreen'
import AuthPage from './site/AuthPage'
import ArchiveHome from './components/archive/ArchiveHome'
import EditArchiveScreen from './components/archive/EditArchiveScreen'
import FamilyAccessScreen from './components/archive/FamilyAccessScreen'
import SettingsScreen from './components/archive/SettingsScreen'
import AskArchiveScreen from './components/archive/AskArchiveScreen'
import VoiceAndPhotoScreen from './components/archive/VoiceAndPhotoScreen'
import ArchiveWorkspace from './components/archive/ArchiveLayout'
import { Loading } from './components/archive/parts'
import { T, radius, sans, serif } from './design/tokens'
import { BRAND, BRAND_SUB } from './design/copy'
import { Body, Btn, Display, Eyebrow } from './design/ui'

const LAST_CREATOR_KEY = 'legacy-ai:last-creator-id'
const PENDING_JOIN_TOKEN_KEY = 'legacy-ai:pending-join-token'

/* ───────────────────────────── plumbing ──────────────────────────── */

function pendingJoinToken() {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(PENDING_JOIN_TOKEN_KEY) || localStorage.getItem(PENDING_JOIN_TOKEN_KEY)
}

function savePendingJoinToken(token: string) {
  sessionStorage.setItem(PENDING_JOIN_TOKEN_KEY, token)
  localStorage.setItem(PENDING_JOIN_TOKEN_KEY, token)
}

function clearPendingJoinToken() {
  sessionStorage.removeItem(PENDING_JOIN_TOKEN_KEY)
  localStorage.removeItem(PENDING_JOIN_TOKEN_KEY)
}

function ownsArchive(me: AccessMe) {
  return me.memberships.some((m) => m.isOwner)
}

function ownedMemberships(me: AccessMe) {
  return me.memberships.filter((m) => m.isOwner)
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: T.paper, fontFamily: sans, color: T.ink,
      gap: 14, padding: '0 24px', textAlign: 'center',
    }}>{children}</div>
  )
}

/** Walnut stays on screen while auth or a route resolves — never a blank cream page. */
function BootScreen({ label }: { label: string }) {
  return (
    <div className="archive-boot" style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: T.paper,
    }}>
      <div style={{
        background: T.walnutDeep, padding: '18px 28px',
        paddingTop: 'max(18px, env(safe-area-inset-top))',
      }}>
        <div style={{ fontFamily: serif, fontSize: 21, color: T.onDark }}>{BRAND}</div>
        <div style={{ marginTop: 5 }}>
          <Eyebrow color="rgba(179,144,47,.85)">{BRAND_SUB}</Eyebrow>
        </div>
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 40 }}>
        <span style={{ fontFamily: serif, fontSize: 17, color: T.ink2 }}>{label}</span>
      </div>
    </div>
  )
}

function PaneNotice({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      gap: 14, padding: '12px 0 24px', maxWidth: 560, textAlign: 'left',
    }}>{children}</div>
  )
}

/** Keeps the ?c= creator query when redirecting an old route to its new home. */
function KeepQueryRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}${location.search}`} replace />
}

/** The former section routes are bands on the main screen now. */
function SectionRedirect({ section }: { section: string }) {
  const location = useLocation()
  return <Navigate to={`/overview${location.search}#${section}`} replace />
}

function membershipHasProgress(m: AccessMe['memberships'][number]) {
  return (m.avatarLevel ?? 0) > 0 || (m.completionScore ?? 0) > 0
}

async function signOutAndClear() {
  clearAuthTokenCache()
  clearPendingJoinToken()
  if (typeof localStorage !== 'undefined') localStorage.removeItem(LAST_CREATOR_KEY)
  await supabase.auth.signOut()
}

function archiveScreen(creatorId: string) {
  return `/overview?c=${creatorId}`
}

function openJoinedArchive(
  navigate: ReturnType<typeof useNavigate>,
  creatorId: string,
  token?: string | null,
) {
  localStorage.setItem(LAST_CREATOR_KEY, creatorId)
  if (token) clearPendingJoinToken()
  navigate(archiveScreen(creatorId), { replace: true })
}

function preferredSharedMembership(me: AccessMe, cached?: string | null) {
  const shared = me.memberships.filter((m) => !m.isOwner)
  if (shared.length === 0) return null
  if (cached) {
    const match = shared.find((m) => m.creatorId === cached)
    if (match) return match
  }
  return shared[0]
}

/** The interview belongs to the person building their own archive — never an invitee. */
function shouldStartInterview(me: AccessMe): boolean {
  if (pendingJoinToken() && !ownsArchive(me)) return false
  const owned = ownedMemberships(me)
  if (owned.find(membershipHasProgress)) return false
  if (owned.length > 0) return can(normalizeRole(owned[0].role), ACTIONS.COMPLETE_INTERVIEW)
  if (me.memberships.some((m) => !m.isOwner)) return false
  return true
}

function canAccessInterview(me: AccessMe): boolean {
  if (pendingJoinToken() && !ownsArchive(me)) return false
  const owned = ownedMemberships(me)
  if (owned.length === 0) return me.memberships.filter((m) => !m.isOwner).length === 0
  return can(normalizeRole(owned[0].role), ACTIONS.COMPLETE_INTERVIEW)
}

function isInterviewBlockedError(msg: string | null | undefined) {
  return Boolean(msg && /only for people preserving their own legacy/i.test(msg))
}

function billingAllowsInterview(me: AccessMe) {
  const b = me.billing
  if (!b) return true
  if (typeof b.canInterview === 'boolean') return b.canInterview
  return b.paid
}

function billingAllowsArchive(me: AccessMe) {
  const b = me.billing
  if (!b) return true
  if (typeof b.canViewArchive === 'boolean') return b.canViewArchive
  return b.paid && b.plan !== 'preserve'
}

function isMinutesRequiredError(err: unknown) {
  const code = (err as { code?: string } | null)?.code
  const msg = err instanceof Error ? err.message : ''
  return code === 'MINUTES_REQUIRED' || /minutes are used|add 30 minutes/i.test(msg)
}

function isPaymentRequiredError(err: unknown) {
  const code = (err as { code?: string } | null)?.code
  const msg = err instanceof Error ? err.message : ''
  return code === 'PAYMENT_REQUIRED' || /choose a plan|active plan|payment required/i.test(msg)
}

function pickCreatorId(me: AccessMe, preferred?: string | null): string | null {
  const byId = (id: string) => me.memberships.find((m) => m.creatorId === id)
  const owned = ownedMemberships(me)
  if (preferred) {
    const pref = byId(preferred)
    if (pref?.isOwner) return preferred
    if (pref && owned.length === 0) return preferred
  }
  const activeOwned = owned.find(membershipHasProgress)
  if (activeOwned) return activeOwned.creatorId
  if (owned[0]) return owned[0].creatorId
  const shared = preferredSharedMembership(me, preferred)
  return shared?.creatorId ?? me.memberships[0]?.creatorId ?? null
}

/** Own archive first. Shared archives only when this person has no legacy of their own. */
function resolveDestination(me: AccessMe): string {
  if (!ownsArchive(me)) {
    const pendingJoin = pendingJoinToken()
    if (pendingJoin) return `/join?token=${pendingJoin}`
    if (me.pendingInvitations.length > 0) return `/join?token=${me.pendingInvitations[0].token}`
  } else {
    clearPendingJoinToken()
  }

  const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_CREATOR_KEY) : null
  const picked = pickCreatorId(me, cached)
  if (picked) {
    const m = me.memberships.find((x) => x.creatorId === picked)
    if (m?.isOwner && membershipHasProgress(m)) {
      return billingAllowsArchive(me) ? archiveScreen(picked) : '/unlock'
    }
    if (m && !m.isOwner) return archiveScreen(picked)
  }

  const activeOwned = ownedMemberships(me).find(membershipHasProgress)
  if (activeOwned) {
    return billingAllowsArchive(me) ? archiveScreen(activeOwned.creatorId) : '/unlock'
  }
  if (shouldStartInterview(me)) {
    return billingAllowsInterview(me) ? '/interview' : '/pricing'
  }

  const shared = preferredSharedMembership(me, cached)
  if (shared) return archiveScreen(shared.creatorId)
  if (me.memberships.length > 0) return archiveScreen(me.memberships[0].creatorId)
  return '/interview'
}

/** Never send a blocked user back to /interview (avoids redirect loops). */
function interviewEscapeRoute(me: AccessMe): string {
  const dest = resolveDestination(me)
  if (!dest.startsWith('/interview')) return dest
  const owned = ownedMemberships(me)[0]
  if (owned) return archiveScreen(owned.creatorId)
  const shared = preferredSharedMembership(me)
  if (shared) return archiveScreen(shared.creatorId)
  return '/'
}

function viewerFirstName(session: Session | null) {
  return (
    session?.user.user_metadata?.full_name?.split(' ')[0]
    || session?.user.email?.split('@')[0]
    || 'there'
  )
}

/* ─────────────────────── public site + auth gate ─────────────────── */

function PublicHome({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const explicitNext = params.get('next')

  useEffect(() => {
    if (!session) return
    let active = true
    const pendingJoin = pendingJoinToken()
    if (explicitNext) {
      navigate(explicitNext, { replace: true })
      return
    }
    if (pendingJoin) {
      accessApi.me()
        .then((me) => {
          if (!active) return
          if (!ownsArchive(me)) {
            navigate(`/join?token=${pendingJoin}`, { replace: true })
            return
          }
          clearPendingJoinToken()
        })
        .catch(async (err) => {
          if (!active) return
          const msg = err instanceof Error ? err.message : ''
          if (isAuthError(msg)) await signOutAndClear()
        })
    }
    return () => { active = false }
  }, [session, navigate, explicitNext])

  return <HomePage />
}

function SignInRoute({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const explicitNext = params.get('next')

  useEffect(() => {
    if (!session) return
    let active = true
    const pendingJoin = pendingJoinToken()
    if (explicitNext) {
      navigate(explicitNext, { replace: true })
      return
    }
    accessApi.me()
      .then((me) => {
        if (!active) return
        if (pendingJoin && !ownsArchive(me)) {
          navigate(`/join?token=${pendingJoin}`, { replace: true })
          return
        }
        if (pendingJoin) clearPendingJoinToken()
        navigate(resolveDestination(me), { replace: true })
      })
      .catch(() => { if (active) navigate('/overview', { replace: true }) })
    return () => { active = false }
  }, [session, navigate, explicitNext])
  return <AuthPage />
}

/* ─────────────────────── archive route wrappers ──────────────────── */

/** Resolves ?c= for the section screens; sends a signed-in user with no archive onward. */
function ArchiveRoute({
  session, render,
}: {
  session: Session | null
  render: (creatorIdParam: string | undefined, session: Session) => React.ReactNode
}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const creatorIdParam = params.get('c') || undefined
  const [resolving, setResolving] = useState(true)

  /**
   * Sending someone to the page they are already on would leave the boot screen up forever —
   * a first-time owner has no archive row yet, and loading the workspace is what creates it.
   */
  const leaveOrStay = useCallback((me: AccessMe) => {
    const dest = resolveDestination(me)
    const url = new URL(dest, window.location.origin)
    const here = new URLSearchParams(window.location.search).get('c') || ''
    if (url.pathname === window.location.pathname && (url.searchParams.get('c') || '') === here) {
      setResolving(false)
      return
    }
    navigate(dest, { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!session) return
    let active = true
    accessApi.me()
      .then((me) => {
        if (!active) return
        if (creatorIdParam) {
          const allowed = me.memberships.some((m) => m.creatorId === creatorIdParam)
          if (!allowed) {
            localStorage.removeItem(LAST_CREATOR_KEY)
            leaveOrStay(me)
            return
          }
          setResolving(false)
          return
        }
        const cached = localStorage.getItem(LAST_CREATOR_KEY)
        const picked = pickCreatorId(me, cached)
        if (picked) {
          localStorage.setItem(LAST_CREATOR_KEY, picked)
          const next = new URLSearchParams(window.location.search)
          next.set('c', picked)
          navigate(`${window.location.pathname}?${next.toString()}`, { replace: true })
          return
        }
        leaveOrStay(me)
      })
      .catch(async (e) => {
        if (!active) return
        const msg = e instanceof Error ? e.message : ''
        if (isAuthError(msg)) await signOutAndClear()
        else setResolving(false)
      })
    return () => { active = false }
  }, [session, creatorIdParam, navigate, leaveOrStay])

  if (!session) return <Navigate to="/" replace />
  if (resolving) return <BootScreen label="Opening your archive…" />
  return <>{render(creatorIdParam, session)}</>
}

/* ─────────────────────────────── Interview ───────────────────────── */

function InterviewPage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const requestedStage = params.get('stage') || undefined
  const startTimeRef = useRef<number>(Date.now())

  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [needsPayment, setNeedsPayment] = useState(false)
  const [needsMinutes, setNeedsMinutes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [extractionResult, setExtractionResult] = useState<CompleteResult | null>(null)
  const lastAnswersRef = useRef<Answer[]>([])
  const lastExclusionsRef = useRef<string[]>([])
  const [aiVoice, setAiVoice] = useState(false)
  const [archiveLocked, setArchiveLocked] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    let active = true
    checkAiVoiceAvailable()
      .then((ok) => { if (active) setAiVoice(ok) })
      .catch(() => { if (active) setAiVoice(false) })
    return () => { active = false }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    setRedirecting(false)
    setNeedsPayment(false)
    setNeedsMinutes(false)

    accessApi.me()
      .then((me) => {
        if (!active) return null
        if (pendingJoinToken()) {
          setRedirecting(true)
          navigate(`/join?token=${pendingJoinToken()}`, { replace: true })
          return null
        }
        if (!canAccessInterview(me)) {
          setRedirecting(true)
          navigate(interviewEscapeRoute(me), { replace: true })
          return null
        }
        setArchiveLocked(!billingAllowsArchive(me))
        return interviewApi.getSession(requestedStage ? { stage: requestedStage } : undefined)
      })
      .then((data) => { if (active && data != null) setSessionData(data) })
      .catch(async (e) => {
        if (!active) return
        const msg = e instanceof Error ? e.message : 'Could not open the interview.'
        if (isAuthError(msg)) { await signOutAndClear(); return }
        if (isMinutesRequiredError(e)) {
          setNeedsMinutes(true)
          return
        }
        if (isPaymentRequiredError(e)) {
          setNeedsPayment(true)
          return
        }
        if (isInterviewBlockedError(msg)) {
          setRedirecting(true)
          try {
            const me = await accessApi.me()
            if (active) navigate(interviewEscapeRoute(me), { replace: true })
          } catch {
            if (active) navigate('/', { replace: true })
          }
          return
        }
        setError(msg)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session?.user?.id, navigate, requestedStage])

  if (!session) return <Navigate to="/" replace />

  const displayName = sessionData?.creator.display_name || viewerFirstName(session)

  const handleAnswerCommit = async (payload: Answer & { questionIndex: number; skipped: boolean }) => {
    if (!sessionData) return
    const saved = await interviewApi.saveAnswer(sessionData.session.id, {
      questionIndex: payload.questionIndex,
      question: payload.question,
      answer: payload.answer,
      mode: payload.mode,
      skipped: payload.skipped,
    })
    if (saved.questions?.length) {
      setSessionData((prev) => prev ? { ...prev, questions: saved.questions! } : prev)
      return { questions: saved.questions }
    }
  }

  const handleComplete = async (answers: Answer[], meta?: { topicExclusions?: string[] }) => {
    if (!sessionData) return
    lastAnswersRef.current = answers
    lastExclusionsRef.current = meta?.topicExclusions || []
    setProcessing(true)
    setProcessingError(null)
    setExtractionResult(null)
    const COMPLETE_TIMEOUT_MS = 120_000
    try {
      const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const payload = {
        durationSeconds,
        answers: answers.map((a, i) => ({
          questionIndex: i, question: a.question, answer: a.answer, mode: a.mode,
        })),
        topicExclusions: meta?.topicExclusions || [],
      }
      const result = await Promise.race([
        interviewApi.complete(sessionData.session.id, payload) as Promise<CompleteResult>,
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error(
            'Saving is taking longer than expected. Your answers are saved — try again, or open your archive.',
          )), COMPLETE_TIMEOUT_MS)
        }),
      ])
      setExtractionResult(result)
    } catch (e) {
      setProcessingError(e instanceof Error ? e.message : 'Could not save this session')
    } finally {
      setProcessing(false)
    }
  }

  const goToArchive = () => {
    if (archiveLocked) {
      navigate('/unlock', { replace: true })
      return
    }
    if (!sessionData?.creator.id) { navigate('/overview'); return }
    navigate(archiveScreen(sessionData.creator.id), {
      replace: true,
      state: {
        profileRefresh: Date.now(),
        justCompletedStage: extractionResult?.stage || sessionData.stage,
      },
    })
  }

  if (redirecting) return <Loading label="Opening your archive…" />
  if (loading) return <Loading label="Preparing your interview…" />
  if (needsMinutes) {
    return (
      <PaneNotice>
        <PaywallCard
          kind="minutes"
          title="Your minutes are used"
          note="Add 30 minutes to continue the interview and live calls. This only appears on an active Monthly or Set up plan."
        />
      </PaneNotice>
    )
  }
  if (needsPayment) {
    return (
      <PaneNotice>
        <PaywallCard />
      </PaneNotice>
    )
  }

  if (sessionData?.allStagesComplete) {
    return (
      <PaneNotice>
        <Eyebrow>Archive setup</Eyebrow>
        <Display size={30}>Foundation, Enrichment, and Family Archive are all in place</Display>
        <Body size={15} style={{ maxWidth: 460 }}>
          Your archive reflects everything you have shared so far. You can still add entries, voice
          memories, and photographs at any time.
        </Body>
        <Btn onClick={() => navigate(archiveLocked ? '/unlock' : archiveScreen(sessionData.creator.id))}>
          {archiveLocked ? 'See what you need to pay' : 'Open your archive'}
        </Btn>
      </PaneNotice>
    )
  }

  if (error || !sessionData) {
    const authFailed = Boolean(error && isAuthError(error))
    return (
      <PaneNotice>
        <Display size={26}>Could not open the interview</Display>
        <Body size={14.5} style={{ maxWidth: 460 }}>{error || 'Could not load the interview session.'}</Body>
        {error?.includes('legacy_creators') && (
          <div style={{
            fontFamily: sans, fontSize: 14, color: T.ink2, textAlign: 'left', lineHeight: 1.6,
            background: T.card, border: `1px solid ${T.line}`, borderRadius: radius.md,
            padding: '16px 20px', maxWidth: 520,
          }}>
            <strong>Fix:</strong> In <code>back/.env</code>, set your database password in{' '}
            <code>DATABASE_URL</code>, then run:
            <pre style={{
              background: T.paper, padding: 12, borderRadius: radius.sm, overflow: 'auto', fontSize: 13,
            }}>{'cd back\nnpm run setup-db\nnpm run dev'}</pre>
          </div>
        )}
        {authFailed ? (
          <Btn onClick={() => void signOutAndClear()}>Sign in again</Btn>
        ) : (
          <Btn tone="quiet" onClick={() => {
            void accessApi.me()
              .then((me) => navigate(interviewEscapeRoute(me), { replace: true }))
              .catch(async () => {
                const cached = localStorage.getItem(LAST_CREATOR_KEY)
                if (cached) navigate(archiveScreen(cached), { replace: true })
                else await signOutAndClear()
              })
          }}>Back to the archive</Btn>
        )}
      </PaneNotice>
    )
  }

  return (
    <InterviewSession
      embedded
      subjectName={displayName}
      sessionLabel={sessionData.session.label}
      stageLabel={sessionData.stageLabel}
      stageGoal={sessionData.stageGoal}
      stages={sessionData.stages?.map(({ label, done, current }) => ({ label, done, current }))}
      questions={sessionData.questions}
      initialQuestionIndex={sessionData.resumeIndex ?? 0}
      initialAnswers={(sessionData.savedAnswers || []).map((a) => ({
        questionIndex: a.question_index,
        question: a.question,
        answer: a.answer,
        mode: a.answer_mode,
      }))}
      initialTopicExclusions={sessionData.topicExclusions || []}
      priorStories={sessionData.priorStories || []}
      autoStart={(sessionData.savedAnswers?.length ?? 0) > 0}
      interviewStage={sessionData.stage}
      aiVoice={aiVoice}
      tts={aiVoice ? null : browserTts}
      stt={aiVoice ? null : browserStt}
      onAnswerCommit={handleAnswerCommit}
      onComplete={handleComplete}
      onViewAvatar={archiveLocked ? undefined : () => navigate(`/ask?c=${sessionData.creator.id}`)}
      onViewLegacy={goToArchive}
      archiveLocked={archiveLocked}
      onManageAccess={archiveLocked ? undefined : () => navigate(`/family-access?c=${sessionData.creator.id}`)}
      onBack={() => navigate(archiveScreen(sessionData.creator.id))}
      processing={processing}
      processingError={processingError}
      onRetryPreservation={() => {
        if (lastAnswersRef.current.length) {
          void handleComplete(lastAnswersRef.current, { topicExclusions: lastExclusionsRef.current })
        }
      }}
      extractionResult={extractionResult}
    />
  )
}

/* ──────────────────────────────── Join ───────────────────────────── */
function JoinPage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [preview, setPreview] = useState<{
    role: Role
    creatorDisplayName: string | null
    creatorId: string
    alreadyAccepted?: boolean
  } | null>(null)
  const previewRef = useRef(preview)
  previewRef.current = preview
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    savePendingJoinToken(token)
    accessApi.previewInvite(token)
      .then((p) => setPreview({
        role: p.role,
        creatorDisplayName: p.creatorDisplayName,
        creatorId: p.creatorId,
        alreadyAccepted: p.alreadyAccepted,
      }))
      .catch(() => { /* preview optional — accepting still works */ })
  }, [token])

  useEffect(() => {
    if (!session || !token) return
    let active = true
    setStatus('working')

    const finishFromMembership = (me: AccessMe, creatorId: string) => {
      const membership = me.memberships.find((m) => m.creatorId === creatorId)
      if (!membership) return false
      openJoinedArchive(navigate, membership.creatorId, token)
      return true
    }

    void (async () => {
      let invitePreview = previewRef.current
      if (!invitePreview) {
        try {
          const p = await accessApi.previewInvite(token)
          invitePreview = {
            role: p.role,
            creatorDisplayName: p.creatorDisplayName,
            creatorId: p.creatorId,
            alreadyAccepted: p.alreadyAccepted,
          }
          setPreview(invitePreview)
        } catch { /* accepting may still work */ }
      }

      try {
        const me = await accessApi.me()
        if (invitePreview?.creatorId && finishFromMembership(me, invitePreview.creatorId)) return
        if (invitePreview?.alreadyAccepted && invitePreview.creatorId) {
          setStatus('error')
          setMessage('This invitation was already used. Sign in with the account that joined this archive.')
          return
        }
        const res = await accessApi.acceptInvitation(token)
        openJoinedArchive(navigate, res.creatorId, token)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not accept this invitation'
        try {
          const me = await accessApi.me()
          const creatorId = invitePreview?.creatorId
          if (creatorId && finishFromMembership(me, creatorId)) return
          if (/no longer valid|already|duplicate|conflict/i.test(msg)) {
            const shared = me.memberships.filter((m) => !m.isOwner)
            const match = (creatorId && shared.find((m) => m.creatorId === creatorId)) || shared[0]
            if (match) { openJoinedArchive(navigate, match.creatorId, token); return }
          }
        } catch { /* fall through */ }
        if (!active) return
        setStatus('error')
        setMessage(msg)
      }
    })()

    return () => { active = false }
  }, [session, token, navigate])

  if (!token) {
    return (
      <Centered>
        <Display size={26}>This invitation link is not valid</Display>
        <Btn tone="quiet" onClick={() => navigate('/')}>Go to {BRAND}</Btn>
      </Centered>
    )
  }

  if (!session) {
    const archiveName = preview?.creatorDisplayName
      ? `${preview.creatorDisplayName}’s archive`
      : 'a private family archive'
    return (
      <Centered>
        <Eyebrow>{BRAND} · invitation</Eyebrow>
        <Display size={32}>You have been invited to {archiveName}</Display>
        <Body size={15} style={{ maxWidth: 460 }}>
          Create an account and you will be added automatically. You will see only what the archive
          owner has chosen to share.
        </Body>
        <Btn size="lg" onClick={() => navigate(`/signin?new=1&next=/join?token=${token}`)}>
          Create your account
        </Btn>
        <Btn tone="quiet" onClick={() => navigate(`/signin?next=/join?token=${token}`)}>
          I already have an account
        </Btn>
      </Centered>
    )
  }

  return (
    <Centered>
      {status === 'error' ? (
        <>
          <Display size={26}>Could not open this archive</Display>
          <Body size={14.5} style={{ maxWidth: 460 }}>{message}</Body>
          <Btn onClick={() => {
            void accessApi.me()
              .then((me) => navigate(resolveDestination(me), { replace: true }))
              .catch(() => navigate('/'))
          }}>Continue</Btn>
        </>
      ) : (
        <span style={{ fontFamily: serif, fontSize: 17, color: T.ink2 }}>Joining…</span>
      )}
    </Centered>
  )
}

/* ──────────────────────────────── App ────────────────────────────── */
export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED') return
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') clearAuthTokenCache()
      if (event === 'SIGNED_IN' && s?.user?.id) {
        accessApi.me()
          .then((me) => {
            if (ownsArchive(me)) clearPendingJoinToken()
            const cached = localStorage.getItem(LAST_CREATOR_KEY)
            if (cached && !me.memberships.some((m) => m.creatorId === cached)) {
              localStorage.removeItem(LAST_CREATOR_KEY)
            }
          })
          .catch(() => { /* ignore */ })
      }
      setSession(s)
      setAuthReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!authReady) return <BootScreen label="Opening your archive…" />

  const viewer = viewerFirstName(session)

  return (
    <BrowserRouter>
      <Routes>
        {/* public site */}
        <Route path="/" element={<PublicHome session={session} />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/the-archive" element={<TheArchivePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/unlock" element={<UnlockArchiveScreen />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/signin" element={<SignInRoute session={session} />} />
        <Route path="/admin" element={<AdminPage />} />

        {/* the archive — one shell; sidebar does not remount */}
        <Route
          element={
            <ArchiveRoute
              session={session}
              render={(c, s) => (
                <ArchiveWorkspace
                  creatorIdParam={c}
                  viewerName={viewer}
                  viewerEmail={s.user.email}
                />
              )}
            />
          }
        >
          <Route path="/overview" element={<ArchiveHome />} />
          <Route path="/edit" element={
            <RequireAction action={ACTIONS.EDIT_MEMORY}>
              <EditArchiveScreen />
            </RequireAction>
          } />
          <Route path="/voice-and-photo" element={
            <RequireAction action={ACTIONS.EDIT_PROFILE}>
              <VoiceAndPhotoScreen />
            </RequireAction>
          } />
          <Route path="/family-access" element={
            <RequireAction action={[ACTIONS.INVITE_USER, ACTIONS.MANAGE_ACCESS]}>
              <FamilyAccessScreen />
            </RequireAction>
          } />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/ask" element={<AskArchiveScreen />} />
          <Route path="/interview" element={<InterviewPage session={session} />} />
        </Route>
        <Route path="/join" element={<JoinPage session={session} />} />

        {/* previous routes → their new homes */}
        <Route path="/stories" element={<SectionRedirect section="stories" />} />
        <Route path="/voice-memories" element={<SectionRedirect section="voice" />} />
        <Route path="/photos" element={<SectionRedirect section="photos" />} />
        <Route path="/people" element={<SectionRedirect section="people" />} />
        <Route path="/home" element={<KeepQueryRedirect to="/overview" />} />
        <Route path="/legacy" element={<KeepQueryRedirect to="/overview" />} />
        <Route path="/avatar" element={<KeepQueryRedirect to="/ask" />} />
        <Route path="/studio" element={<KeepQueryRedirect to="/voice-and-photo" />} />
        <Route path="/live-avatar" element={<KeepQueryRedirect to="/voice-and-photo" />} />
        <Route path="/manage" element={<KeepQueryRedirect to="/family-access" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
