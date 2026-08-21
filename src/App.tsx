import { useEffect, useRef, useState } from 'react'
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
import AvatarStudio from './components/AvatarStudio'
import { ACTIONS, can, normalizeRole } from './lib/permissions'

import HomePage from './site/HomePage'
import { AboutPage, HowItWorksPage, PricingPage, TheArchivePage } from './site/InfoPages'
import AuthPage from './site/AuthPage'
import OverviewScreen from './components/archive/OverviewScreen'
import StoriesScreen from './components/archive/StoriesScreen'
import VoiceMemoriesScreen from './components/archive/VoiceMemoriesScreen'
import PhotosScreen from './components/archive/PhotosScreen'
import PeopleScreen from './components/archive/PeopleScreen'
import FamilyAccessScreen from './components/archive/FamilyAccessScreen'
import SettingsScreen from './components/archive/SettingsScreen'
import AskArchiveScreen from './components/archive/AskArchiveScreen'
import { T, radius, sans, serif } from './design/tokens'
import { BRAND } from './design/copy'
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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: T.paper, fontFamily: sans, color: T.ink,
      gap: 14, padding: '0 24px', textAlign: 'center',
    }}>{children}</div>
  )
}

/** Keeps the ?c= creator query when redirecting an old route to its new home. */
function KeepQueryRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}${location.search}`} replace />
}

function membershipHasProgress(m: AccessMe['memberships'][number]) {
  return (m.avatarLevel ?? 0) > 0 || (m.completionScore ?? 0) > 0
}

async function signOutAndClear() {
  clearAuthTokenCache()
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
  if (pendingJoinToken()) return false
  const shared = me.memberships.filter((m) => !m.isOwner)
  const owned = me.memberships.filter((m) => m.isOwner)
  if (owned.find(membershipHasProgress)) return false
  if (shared.length > 0) return false
  if (owned.length > 0) return can(normalizeRole(owned[0].role), ACTIONS.COMPLETE_INTERVIEW)
  return true
}

function canAccessInterview(me: AccessMe): boolean {
  if (pendingJoinToken()) return false
  const owned = me.memberships.filter((m) => m.isOwner)
  if (owned.length === 0) return me.memberships.filter((m) => !m.isOwner).length === 0
  return can(normalizeRole(owned[0].role), ACTIONS.COMPLETE_INTERVIEW)
}

function isInterviewBlockedError(msg: string | null | undefined) {
  return Boolean(msg && /only for people preserving their own legacy/i.test(msg))
}

function pickCreatorId(me: AccessMe, preferred?: string | null): string | null {
  const byId = (id: string) => me.memberships.find((m) => m.creatorId === id)
  if (preferred) {
    const pref = byId(preferred)
    if (pref && (!pref.isOwner || membershipHasProgress(pref))) return preferred
  }
  const activeOwned = me.memberships.find((m) => m.isOwner && membershipHasProgress(m))
  if (activeOwned) return activeOwned.creatorId
  const shared = me.memberships.find((m) => !m.isOwner)
  if (shared) return shared.creatorId
  const owned = me.memberships.find((m) => m.isOwner)
  return owned?.creatorId ?? me.memberships[0]?.creatorId ?? null
}

/** Where a signed-in person should land: a shared archive first, then their own interview. */
function resolveDestination(me: AccessMe): string {
  const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_CREATOR_KEY) : null
  const picked = pickCreatorId(me, cached)
  if (picked) {
    const m = me.memberships.find((x) => x.creatorId === picked)
    if (m && (!m.isOwner || membershipHasProgress(m))) return archiveScreen(picked)
  }

  const activeOwned = me.memberships.filter((m) => m.isOwner).find(membershipHasProgress)
  if (activeOwned) return archiveScreen(activeOwned.creatorId)

  const shared = preferredSharedMembership(me, cached)
  if (shared) return archiveScreen(shared.creatorId)

  const pendingJoin = pendingJoinToken()
  if (pendingJoin) return `/join?token=${pendingJoin}`
  if (me.pendingInvitations.length > 0) return `/join?token=${me.pendingInvitations[0].token}`
  if (shouldStartInterview(me)) return '/interview'
  if (me.memberships.length > 0) return archiveScreen(me.memberships[0].creatorId)
  return '/interview'
}

/** Never send a blocked user back to /interview (avoids redirect loops). */
function interviewEscapeRoute(me: AccessMe): string {
  const dest = resolveDestination(me)
  if (!dest.startsWith('/interview')) return dest
  const shared = preferredSharedMembership(me)
  if (shared) return archiveScreen(shared.creatorId)
  const owned = me.memberships.find((m) => m.isOwner)
  if (owned) return archiveScreen(owned.creatorId)
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
    if (pendingJoin) {
      navigate(`/join?token=${pendingJoin}`, { replace: true })
      return
    }
    if (explicitNext) {
      navigate(explicitNext, { replace: true })
      return
    }
    accessApi.me()
      .then((me) => { if (active) navigate(resolveDestination(me), { replace: true }) })
      .catch(async (err) => {
        if (!active) return
        const msg = err instanceof Error ? err.message : ''
        if (isAuthError(msg)) await signOutAndClear()
      })
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
    if (pendingJoin) {
      navigate(`/join?token=${pendingJoin}`, { replace: true })
      return
    }
    if (explicitNext) {
      navigate(explicitNext, { replace: true })
      return
    }
    accessApi.me()
      .then((me) => { if (active) navigate(resolveDestination(me), { replace: true }) })
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
  const [resolving, setResolving] = useState(!creatorIdParam)

  useEffect(() => {
    if (!session || creatorIdParam) return
    let active = true
    accessApi.me()
      .then((me) => {
        if (!active) return
        const cached = localStorage.getItem(LAST_CREATOR_KEY)
        const picked = pickCreatorId(me, cached)
        if (picked) {
          localStorage.setItem(LAST_CREATOR_KEY, picked)
          navigate(`${window.location.pathname}?c=${picked}`, { replace: true })
          return
        }
        navigate(resolveDestination(me), { replace: true })
      })
      .catch(async (e) => {
        if (!active) return
        const msg = e instanceof Error ? e.message : ''
        if (isAuthError(msg)) await signOutAndClear()
        else setResolving(false)
      })
    return () => { active = false }
  }, [session, creatorIdParam, navigate])

  if (!session) return <Navigate to="/" replace />
  if (resolving && !creatorIdParam) {
    return (
      <Centered>
        <span style={{ fontFamily: serif, fontSize: 17, color: T.ink2 }}>Opening your archive…</span>
      </Centered>
    )
  }
  return <>{render(creatorIdParam, session)}</>
}

/* ─────────────────────────────── Interview ───────────────────────── */

function InterviewPage({ session, authReady }: { session: Session | null; authReady: boolean }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const requestedStage = params.get('stage') || undefined
  const startTimeRef = useRef<number>(Date.now())

  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [extractionResult, setExtractionResult] = useState<CompleteResult | null>(null)
  const lastAnswersRef = useRef<Answer[]>([])
  const lastExclusionsRef = useRef<string[]>([])
  const [aiVoice, setAiVoice] = useState(false)
  const [aiVoiceReady, setAiVoiceReady] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    let active = true
    setAiVoiceReady(false)
    checkAiVoiceAvailable()
      .then((ok) => { if (active) { setAiVoice(ok); setAiVoiceReady(true) } })
      .catch(() => { if (active) { setAiVoice(false); setAiVoiceReady(true) } })
    return () => { active = false }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    setRedirecting(false)

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
        return interviewApi.getSession(requestedStage ? { stage: requestedStage } : undefined)
      })
      .then((data) => { if (active && data != null) setSessionData(data) })
      .catch(async (e) => {
        if (!active) return
        const msg = e instanceof Error ? e.message : 'Could not open the interview.'
        if (isAuthError(msg)) { await signOutAndClear(); return }
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

  if (!authReady) return <Centered><span style={{ fontFamily: serif, color: T.ink2 }}>Loading…</span></Centered>
  if (!session) return <Navigate to="/" replace />

  const displayName = sessionData?.creator.display_name || viewerFirstName(session)

  const handleAnswerCommit = async (payload: Answer & { questionIndex: number; skipped: boolean }) => {
    if (!sessionData) return
    await interviewApi.saveAnswer(sessionData.session.id, {
      questionIndex: payload.questionIndex,
      question: payload.question,
      answer: payload.answer,
      mode: payload.mode,
      skipped: payload.skipped,
    })
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
    if (!sessionData?.creator.id) { navigate('/overview'); return }
    navigate(archiveScreen(sessionData.creator.id), {
      replace: true,
      state: {
        profileRefresh: Date.now(),
        justCompletedStage: extractionResult?.stage || sessionData.stage,
      },
    })
  }

  if (redirecting) {
    return <Centered><span style={{ fontFamily: serif, color: T.ink2 }}>Opening your archive…</span></Centered>
  }
  if (loading || !aiVoiceReady) {
    return <Centered><span style={{ fontFamily: serif, color: T.ink2 }}>Preparing your interview…</span></Centered>
  }

  if (sessionData?.allStagesComplete) {
    return (
      <Centered>
        <Eyebrow>Archive setup</Eyebrow>
        <Display size={30}>Foundation, Enrichment, and Family Archive are all in place</Display>
        <Body size={15} style={{ maxWidth: 460 }}>
          Your archive reflects everything you have shared so far. You can still add entries, voice
          memories, and photographs at any time.
        </Body>
        <Btn onClick={() => navigate(archiveScreen(sessionData.creator.id))}>Open your archive</Btn>
      </Centered>
    )
  }

  if (error || !sessionData) {
    const authFailed = Boolean(error && isAuthError(error))
    return (
      <Centered>
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
      </Centered>
    )
  }

  return (
    <InterviewSession
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
      autoStart={(sessionData.savedAnswers?.length ?? 0) > 0}
      interviewStage={sessionData.stage}
      aiVoice={aiVoice}
      tts={aiVoice ? null : browserTts}
      stt={aiVoice ? null : browserStt}
      onAnswerCommit={handleAnswerCommit}
      onComplete={handleComplete}
      onViewAvatar={() => navigate(`/ask?c=${sessionData.creator.id}`)}
      onViewLegacy={goToArchive}
      onManageAccess={() => navigate('/family-access')}
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

/* ───────────────────────── voice & photo studio ──────────────────── */
function VoiceAndPhotoPage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  if (!session) return <Navigate to="/" replace />
  return <AvatarStudio onExit={() => navigate('/overview')} />
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

  if (!authReady) return null

  const viewer = viewerFirstName(session)

  return (
    <BrowserRouter>
      <Routes>
        {/* public site */}
        <Route path="/" element={<PublicHome session={session} />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/the-archive" element={<TheArchivePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/signin" element={<SignInRoute session={session} />} />

        {/* the archive */}
        <Route
          path="/overview"
          element={<ArchiveRoute
            session={session}
            render={(c) => <OverviewScreen creatorIdParam={c} viewerName={viewer} />}
          />}
        />
        <Route path="/interview" element={<InterviewPage session={session} authReady={authReady} />} />
        <Route
          path="/stories"
          element={<ArchiveRoute session={session} render={(c) => <StoriesScreen creatorIdParam={c} />} />}
        />
        <Route
          path="/voice-memories"
          element={<ArchiveRoute session={session} render={(c) => <VoiceMemoriesScreen creatorIdParam={c} />} />}
        />
        <Route
          path="/photos"
          element={<ArchiveRoute session={session} render={(c) => <PhotosScreen creatorIdParam={c} />} />}
        />
        <Route
          path="/people"
          element={<ArchiveRoute session={session} render={(c) => <PeopleScreen creatorIdParam={c} />} />}
        />
        <Route
          path="/family-access"
          element={<ArchiveRoute session={session} render={(c) => <FamilyAccessScreen creatorIdParam={c} />} />}
        />
        <Route
          path="/settings"
          element={<ArchiveRoute
            session={session}
            render={(c, s) => <SettingsScreen creatorIdParam={c} viewerEmail={s.user.email} />}
          />}
        />
        <Route
          path="/ask"
          element={<ArchiveRoute
            session={session}
            render={(c) => <AskArchiveScreen creatorIdParam={c} viewerName={viewer} />}
          />}
        />
        <Route path="/voice-and-photo" element={<VoiceAndPhotoPage session={session} />} />
        <Route path="/join" element={<JoinPage session={session} />} />

        {/* previous routes → their new homes */}
        <Route path="/home" element={<KeepQueryRedirect to="/overview" />} />
        <Route path="/legacy" element={<KeepQueryRedirect to="/overview" />} />
        <Route path="/avatar" element={<KeepQueryRedirect to="/ask" />} />
        <Route path="/studio" element={<KeepQueryRedirect to="/voice-and-photo" />} />
        <Route path="/manage" element={<KeepQueryRedirect to="/family-access" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
