import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { requestPasswordReset, signInWithPassword, signUpWithPassword } from './lib/auth'
import {
  accessApi,
  avatarApi,
  clearAuthTokenCache,
  interviewApi,
  uploadMedia,
  type AccessMe,
  type InterviewSessionData,
  type Role,
  type CompleteResult,
} from './lib/api'
import { browserStt, browserTts } from './lib/voice'
import { checkAiVoiceAvailable } from './lib/openaiRealtimeInterview'
import LegacyWelcome, { type SignInValues, type SignUpValues } from './components/LegacyWelcome'
import InterviewSession, { type Answer } from './components/InterviewSession'
import LegacyAvatar from './components/LegacyAvatar'
import ManageAccess from './components/ManageAccess'
import RoleHome, { type RoleHomeData } from './components/RoleHome'
import MemoryEditorModal, { type MemoryFormValues } from './components/MemoryEditorModal'
import GalleryUploadModal from './components/GalleryUploadModal'
import VoiceRecordModal from './components/VoiceRecordModal'
import AvatarStudio from './components/AvatarStudio'
import { mapProfileToAvatarData } from './lib/mapAvatarData'
import { mapProfileToRoleHomeData } from './lib/mapRoleHomeData'
import { ACTIONS, can, normalizeRole } from './lib/permissions'

const C = {
  paper: '#ece3d2', card: '#fbf6ec', ink: '#2b241c', ink2: '#6e6253',
  ink3: '#9a8d79', line: '#ddccb0', terra: '#c06a44', sage: '#71805c',
}
const serif = "'Newsreader', Georgia, serif"
const sans = "'Hanken Grotesk', system-ui, sans-serif"
const mono = "'Spline Sans Mono', ui-monospace, monospace"
const LAST_CREATOR_KEY = 'legacy-ai:last-creator-id'

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.paper, fontFamily: sans, color: C.ink, gap: 12, padding: '0 24px' }}>
      {children}
    </div>
  )
}

const primaryBtn: React.CSSProperties = { background: C.ink, color: C.paper, border: 'none', borderRadius: 999, padding: '12px 24px', fontFamily: sans, fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { background: 'transparent', border: `1px solid ${C.line}`, color: C.ink2, borderRadius: 999, padding: '11px 20px', fontFamily: sans, fontWeight: 500, fontSize: 14, cursor: 'pointer' }
const floatBtn: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, color: C.ink2, borderRadius: 999, padding: '9px 16px', fontFamily: sans, fontSize: 13, fontWeight: 500, cursor: 'pointer', boxShadow: '0 4px 14px rgba(43,36,28,.12)' }

function LegacyCreatorNav({
  creatorId,
  active,
}: {
  creatorId?: string
  active?: 'legacy' | 'avatar'
}) {
  const navigate = useNavigate()
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const activeBtn: React.CSSProperties = { ...floatBtn, background: C.ink, color: C.paper, border: `1px solid ${C.ink}`, fontWeight: 600, cursor: 'default' }

  return (
    <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 100, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => active !== 'legacy' && navigate(`/legacy${cQuery}`)}
        style={active === 'legacy' ? activeBtn : floatBtn}
        disabled={active === 'legacy'}
      >
        Edit my legacy
      </button>
      <button
        type="button"
        onClick={() => active !== 'avatar' && navigate(`/avatar${cQuery}`)}
        style={active === 'avatar' ? activeBtn : floatBtn}
        disabled={active === 'avatar'}
      >
        View my legacy
      </button>
    </div>
  )
}

function membershipHasProgress(m: AccessMe['memberships'][number]) {
  return (m.avatarLevel ?? 0) > 0 || (m.completionScore ?? 0) > 0
}

/** Pick where a signed-in user should land — active legacy first, then shared, then interview. */
function resolveLegacyDestination(me: AccessMe): string {
  const owned = me.memberships.filter((m) => m.isOwner)
  const shared = me.memberships.filter((m) => !m.isOwner)

  const activeOwned = owned.find(membershipHasProgress)
  if (activeOwned) return `/legacy?c=${activeOwned.creatorId}`

  if (shared.length > 0) return `/legacy?c=${shared[0].creatorId}`

  if (owned.length > 0) return '/interview'

  if (me.pendingInvitations.length > 0) return `/join?token=${me.pendingInvitations[0].token}`
  return '/interview'
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

/* ─────────────────────────────── Welcome ─────────────────────────────── */
function WelcomePage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const explicitNext = params.get('next')
  const startSignIn = params.get('signin') === '1'
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'signup' | 'signin' | undefined>(startSignIn ? 'signin' : undefined)

  useEffect(() => {
    if (!session) return
    let active = true
    const explicitNext = params.get('next')
    if (explicitNext) {
      navigate(explicitNext, { replace: true })
      return
    }
    accessApi.me()
      .then((me) => { if (active) navigate(resolveLegacyDestination(me), { replace: true }) })
      .catch(() => { if (active) navigate('/legacy', { replace: true }) })
    return () => { active = false }
  }, [session, navigate, explicitNext])

  const handleSignUp = async ({ name, email, password }: SignUpValues) => {
    setAuthBusy(true)
    setAuthError(null)
    setAuthNotice(null)
    try {
      const result = await signUpWithPassword(name, email, password)
      if (result.needsEmailConfirmation) {
        setAuthNotice('Account created. Check your email to confirm, then sign in.')
        setAuthMode('signin')
        return
      }
      // onAuthStateChange → useEffect navigates once session is set
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed'
      if (msg.toLowerCase().includes('already exists')) {
        setAuthMode('signin')
        setAuthNotice('You already have an account with this email. Enter your password below to sign in.')
        return
      }
      setAuthError(msg)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignIn = async ({ email, password }: SignInValues) => {
    setAuthBusy(true)
    setAuthError(null)
    setAuthNotice(null)
    try {
      await signInWithPassword(email, password)
      // onAuthStateChange → useEffect navigates once session is set
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed'
      if (msg.toLowerCase().includes('wrong email') || msg.toLowerCase().includes('invalid')) {
        setAuthError('Wrong email or password. Use “Forgot password?” if you need to reset it.')
        return
      }
      setAuthError(msg)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleForgotPassword = async (email: string) => {
    if (!email) {
      setAuthError('Enter your email above, then click Forgot password.')
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    setAuthNotice(null)
    try {
      await requestPasswordReset(email, window.location.origin)
      setAuthNotice(`Password reset link sent to ${email}. Check your inbox, then sign in here.`)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Could not send reset email')
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <LegacyWelcome
      onSignUp={handleSignUp}
      onSignIn={handleSignIn}
      onForgotPassword={handleForgotPassword}
      authBusy={authBusy}
      authError={authError}
      authNotice={authNotice}
      authMode={authMode}
      onClearAuthFeedback={() => { setAuthError(null); setAuthNotice(null) }}
    />
  )
}

/* ───────────────────────── Role-based home (3 screens) ─────────────────── */
function LegacyHomePage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const creatorIdParam = params.get('c') || undefined
  const navigateProfileRefresh = (location.state as { profileRefresh?: number } | null)?.profileRefresh
  const justCompletedStage = (location.state as { justCompletedStage?: string } | null)?.justCompletedStage

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<Role>('member')
  const [creatorId, setCreatorId] = useState<string | undefined>(creatorIdParam)
  const [data, setData] = useState<ReturnType<typeof mapProfileToRoleHomeData> | null>(null)
  const [liveReady, setLiveReady] = useState(false)
  const [homeRefresh, setHomeRefresh] = useState(0)
  const [memoryModal, setMemoryModal] = useState<{
    mode: 'add' | 'edit'
    memory?: RoleHomeData['memories'][number]
  } | null>(null)
  const [memorySaving, setMemorySaving] = useState(false)
  const [memoryError, setMemoryError] = useState<string | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [gallerySaving, setGallerySaving] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [voiceRecordOpen, setVoiceRecordOpen] = useState(false)
  const [voiceRecordSaving, setVoiceRecordSaving] = useState(false)
  const [voiceRecordError, setVoiceRecordError] = useState<string | null>(null)
  const [hasVoiceSample, setHasVoiceSample] = useState(false)

  const reloadLegacyHome = () => setHomeRefresh((n) => n + 1)

  useEffect(() => {
    if (!session || creatorIdParam) return
    let active = true
    accessApi.me()
      .then((me) => {
        if (!active) return
        const cached = localStorage.getItem(LAST_CREATOR_KEY)
        const creatorId = pickCreatorId(me, cached)
        if (cached && cached !== creatorId) localStorage.removeItem(LAST_CREATOR_KEY)
        const membership = creatorId ? me.memberships.find((m) => m.creatorId === creatorId) : null
        if (membership && (!membership.isOwner || membershipHasProgress(membership))) {
          navigate(`/legacy?c=${creatorId}`, { replace: true })
          return
        }
        navigate(resolveLegacyDestination(me), { replace: true })
      })
      .catch((e) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to load your account')
      })
    return () => { active = false }
  }, [session?.user?.id, creatorIdParam, navigate])

  useEffect(() => {
    if (!session || !creatorIdParam) return
    let active = true
    setLoading(true)
    setError(null)

    const viewerName =
      session.user.user_metadata?.full_name?.split(' ')[0] ||
      session.user.email?.split('@')[0] ||
      'there'

    Promise.all([
      interviewApi.getProfile(creatorIdParam),
      avatarApi.getAssets({ creatorId: creatorIdParam, light: true }).catch(() => null),
    ])
      .then(([profile, assetsRes]) => {
        if (!active) return
        const resolvedRole = normalizeRole(profile.role) || 'member'
        const resolvedCreatorId = profile.creator?.id || creatorIdParam

        setRole(resolvedRole)
        setCreatorId(resolvedCreatorId)
        setLiveReady(assetsRes?.liveReady === true)
        setHasVoiceSample(Boolean(assetsRes?.assets?.voice_sample_path))
        setData(mapProfileToRoleHomeData({ profile, viewerName, members: [] }))
        localStorage.setItem(LAST_CREATOR_KEY, resolvedCreatorId)

        if (can(resolvedRole, ACTIONS.MANAGE_ACCESS) || can(resolvedRole, ACTIONS.INVITE_USER)) {
          accessApi.members(resolvedCreatorId)
            .then((m) => {
              if (!active) return
              setData(mapProfileToRoleHomeData({ profile, viewerName, members: m.members }))
            })
            .catch(() => { /* roster is optional */ })
        }
      })
      .catch((e) => {
        if (!active) return
        const denied = e instanceof Error && (e.message.includes('403') || e.message.includes('access'))
        if (denied) {
          localStorage.removeItem(LAST_CREATOR_KEY)
          accessApi.me()
            .then((me) => navigate(resolveLegacyDestination(me), { replace: true }))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your account'))
          return
        }
        setError(e instanceof Error ? e.message : 'Failed to load this legacy')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [session?.user?.id, creatorIdParam, navigateProfileRefresh, homeRefresh])

  useEffect(() => {
    if (!justCompletedStage) return
    navigate(location.pathname + location.search, { replace: true, state: {} })
  }, [justCompletedStage, location.pathname, location.search, navigate])

  if (!session) return <Navigate to="/" replace />
  if (!creatorIdParam) {
    if (error) {
      return (
        <Centered>
          <p style={{ fontWeight: 600 }}>Could not open your legacy</p>
          <p style={{ fontSize: 14, color: C.ink2, textAlign: 'center', maxWidth: 460 }}>{error}</p>
          <button onClick={() => navigate('/interview')} style={primaryBtn}>Start Foundation interview</button>
        </Centered>
      )
    }
    return <Centered><span style={{ fontFamily: serif, color: C.ink2 }}>Opening your legacy…</span></Centered>
  }
  if (loading) return <Centered><span style={{ fontFamily: serif, color: C.ink2 }}>Opening this legacy…</span></Centered>

  if (error || !data) {
    return (
      <Centered>
        <p style={{ fontWeight: 600 }}>Could not open this legacy</p>
        <p style={{ fontSize: 14, color: C.ink2, textAlign: 'center', maxWidth: 460 }}>{error || 'No profile data yet.'}</p>
        <button onClick={() => navigate('/legacy')} style={primaryBtn}>Back</button>
      </Centered>
    )
  }

  const cQuery = creatorId ? `?c=${creatorId}` : ''

  const openAddMemory = () => {
    setMemoryError(null)
    setMemoryModal({ mode: 'add' })
  }

  const openEditMemory = (m: RoleHomeData['memories'][number]) => {
    setMemoryError(null)
    setMemoryModal({ mode: 'edit', memory: m })
  }

  const closeMemoryModal = () => {
    if (memorySaving) return
    setMemoryModal(null)
    setMemoryError(null)
  }

  const handleSaveMemory = async (values: MemoryFormValues) => {
    if (!creatorId) return
    setMemorySaving(true)
    setMemoryError(null)
    try {
      if (memoryModal?.mode === 'edit' && memoryModal.memory?.id) {
        await interviewApi.updateMemory(memoryModal.memory.id, values)
      } else {
        await interviewApi.createMemory({ creatorId, ...values })
      }
      setMemoryModal(null)
      reloadLegacyHome()
    } catch (e) {
      setMemoryError(e instanceof Error ? e.message : 'Could not save memory')
    } finally {
      setMemorySaving(false)
    }
  }

  const handleDeleteMemory = async () => {
    const id = memoryModal?.memory?.id
    if (!id) return
    const title = memoryModal?.memory?.title || 'this memory'
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    setMemorySaving(true)
    setMemoryError(null)
    try {
      await interviewApi.deleteMemory(id)
      setMemoryModal(null)
      reloadLegacyHome()
    } catch (e) {
      setMemoryError(e instanceof Error ? e.message : 'Could not delete memory')
    } finally {
      setMemorySaving(false)
    }
  }

  const openUploadPhoto = () => {
    setGalleryError(null)
    setGalleryOpen(true)
  }

  const closeGalleryModal = () => {
    if (gallerySaving) return
    setGalleryOpen(false)
    setGalleryError(null)
  }

  const handleSaveGalleryPhoto = async (file: File, caption: string, title: string) => {
    if (!creatorId) return
    setGallerySaving(true)
    setGalleryError(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const imagePath = await uploadMedia(creatorId, 'gallery', file, ext, file.type)
      await interviewApi.createGalleryItem({
        creatorId,
        imagePath,
        caption,
        title: title || undefined,
      })
      setGalleryOpen(false)
      reloadLegacyHome()
    } catch (e) {
      setGalleryError(e instanceof Error ? e.message : 'Could not upload photo')
    } finally {
      setGallerySaving(false)
    }
  }

  const handleDeleteGalleryItem = async (id: string) => {
    if (!window.confirm('Remove this photo from the gallery?')) return
    try {
      await interviewApi.deleteGalleryItem(id)
      reloadLegacyHome()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not delete photo')
    }
  }

  const openVoiceRecord = () => {
    setVoiceRecordError(null)
    setVoiceRecordOpen(true)
  }

  const closeVoiceRecord = () => {
    if (voiceRecordSaving) return
    setVoiceRecordOpen(false)
    setVoiceRecordError(null)
  }

  const handleSaveVoiceSample = async (wav: Blob) => {
    if (!creatorId) throw new Error('Could not find your legacy — refresh the page and try again.')
    setVoiceRecordSaving(true)
    setVoiceRecordError(null)
    try {
      const path = await uploadMedia(creatorId, 'voice-sample', wav, 'wav', 'audio/wav')
      await avatarApi.saveVoiceSample(path)
      setVoiceRecordOpen(false)
      reloadLegacyHome()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save recording'
      setVoiceRecordError(message)
      throw e instanceof Error ? e : new Error(message)
    } finally {
      setVoiceRecordSaving(false)
    }
  }

  return (
    <>
      <LegacyCreatorNav creatorId={creatorId} active="legacy" />
      <GalleryUploadModal
        open={galleryOpen}
        saving={gallerySaving}
        error={galleryError}
        onSave={handleSaveGalleryPhoto}
        onClose={closeGalleryModal}
      />
      <VoiceRecordModal
        open={voiceRecordOpen}
        saving={voiceRecordSaving}
        error={voiceRecordError}
        hasExisting={hasVoiceSample}
        onSave={handleSaveVoiceSample}
        onClose={closeVoiceRecord}
      />
      <MemoryEditorModal
        open={memoryModal !== null}
        mode={memoryModal?.mode || 'add'}
        initial={memoryModal?.memory ? {
          title: memoryModal.memory.title,
          summary: memoryModal.memory.summary || '',
          year: memoryModal.memory.year || '',
          category: memoryModal.memory.category || 'story',
        } : undefined}
        saving={memorySaving}
        error={memoryError}
        onSave={handleSaveMemory}
        onDelete={memoryModal?.mode === 'edit' ? handleDeleteMemory : undefined}
        onClose={closeMemoryModal}
      />
      <RoleHome
      role={role}
      data={data}
      liveReady={liveReady}
      justCompletedStage={justCompletedStage}
      onBack={() => navigate(`/legacy${cQuery}`)}
      onSignOut={() => supabase.auth.signOut()}
      onContinueInterview={() => navigate('/interview')}
      onPreviewAvatar={() => navigate(`/avatar${cQuery}`)}
      onCreateAvatar={() => navigate('/studio')}
      onTalk={() => navigate(`/avatar${cQuery}`)}
      onAddMemory={openAddMemory}
      onEditMemory={openEditMemory}
      onDeleteMemory={async (m) => {
        if (!m.id) {
          window.alert('This memory cannot be deleted from here.')
          return
        }
        if (!window.confirm(`Delete "${m.title}"? This cannot be undone.`)) return
        try {
          await interviewApi.deleteMemory(m.id)
          reloadLegacyHome()
        } catch (e) {
          window.alert(e instanceof Error ? e.message : 'Could not delete memory')
        }
      }}
      onAction={(action) => {
        if (action === ACTIONS.COMPLETE_INTERVIEW) navigate('/interview')
        else if (action === ACTIONS.ADD_MEMORY) openAddMemory()
        else if (action === ACTIONS.UPLOAD_MEDIA) openUploadPhoto()
        else if (action === ACTIONS.RECORD_VOICE) openVoiceRecord()
        else if (action === 'view_avatar') navigate(`/avatar${cQuery}`)
      }}
      onUploadPhoto={openUploadPhoto}
      onDeleteGalleryItem={handleDeleteGalleryItem}
      onAppointAdmin={() => navigate(`/manage${cQuery}`)}
      onInvite={() => navigate(`/manage${cQuery}`)}
      onManageMember={() => navigate(`/manage${cQuery}`)}
      onAsk={() => navigate(`/avatar${cQuery}`)}
      onBrowse={() => navigate(`/avatar${cQuery}`)}
      onHearStory={() => navigate(`/avatar${cQuery}`)}
      />
    </>
  )
}

/* ─────────────────────────────── Interview ───────────────────────────── */
function InterviewPage({ session, authReady }: { session: Session | null; authReady: boolean }) {
  const navigate = useNavigate()
  const startTimeRef = useRef<number>(Date.now())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [extractionResult, setExtractionResult] = useState<CompleteResult | null>(null)
  const lastAnswersRef = useRef<Answer[]>([])
  const [aiVoice, setAiVoice] = useState(false)
  const [aiVoiceReady, setAiVoiceReady] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    let active = true
    setAiVoiceReady(false)
    checkAiVoiceAvailable()
      .then((ok) => {
        if (!active) return
        setAiVoice(ok)
        setAiVoiceReady(true)
      })
      .catch(() => {
        if (active) {
          setAiVoice(false)
          setAiVoiceReady(true)
        }
      })
    return () => { active = false }
  }, [session?.user?.id])

  const goToUpdatedLegacy = () => {
    if (!sessionData?.creator.id) return
    navigate(`/legacy?c=${sessionData.creator.id}`, {
      replace: true,
      state: {
        profileRefresh: Date.now(),
        justCompletedStage: extractionResult?.stage || sessionData.stage,
      },
    })
  }

  useEffect(() => {
    if (!session) return
    let active = true
    interviewApi.getSession()
      .then((data) => { if (active) setSessionData(data) })
      .catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session?.user?.id])

  if (!authReady) {
    return <Centered><span style={{ fontFamily: serif, color: C.ink2 }}>Loading…</span></Centered>
  }
  if (!session) return <Navigate to="/" replace />

  const displayName =
    sessionData?.creator.display_name ||
    session.user.user_metadata?.full_name?.split(' ')[0] ||
    session.user.email?.split('@')[0] ||
    'Friend'

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

  const handleComplete = async (answers: Answer[]) => {
    if (!sessionData) return
    lastAnswersRef.current = answers
    setProcessing(true)
    setProcessingError(null)
    setExtractionResult(null)
    try {
      const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const result = await interviewApi.complete(sessionData.session.id, {
        durationSeconds,
        answers: answers.map((a, i) => ({
          questionIndex: i,
          question: a.question,
          answer: a.answer,
          mode: a.mode,
        })),
      }) as CompleteResult
      setExtractionResult(result)
    } catch (e) {
      setProcessingError(e instanceof Error ? e.message : 'Failed to process interview')
    } finally {
      setProcessing(false)
    }
  }

  const retryPreservation = () => {
    if (lastAnswersRef.current.length) void handleComplete(lastAnswersRef.current)
  }

  if (loading || !aiVoiceReady) {
    return <Centered><span style={{ fontFamily: serif, color: C.ink2 }}>Preparing your interview…</span></Centered>
  }

  if (sessionData?.allStagesComplete) {
    return (
      <Centered>
        <p style={{ fontFamily: serif, fontSize: 28, margin: 0 }}>All three stages complete</p>
        <p style={{ fontSize: 14, color: C.ink2, textAlign: 'center', maxWidth: 440 }}>Foundation, Enriched, and Legacy are preserved. Your dashboard and avatar reflect everything you've shared.</p>
        <button onClick={() => navigate(`/legacy?c=${sessionData.creator.id}`)} style={primaryBtn}>Back to your legacy</button>
      </Centered>
    )
  }

  if (error || !sessionData) {
    return (
      <Centered>
        <p style={{ fontWeight: 600 }}>Could not start interview</p>
        <p style={{ fontSize: 14, color: C.ink2, textAlign: 'center' }}>{error || 'Could not load interview session.'}</p>
        {error?.includes('legacy_creators') && (
          <div style={{ fontSize: 14, color: C.ink2, textAlign: 'left', lineHeight: 1.6, background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: '16px 20px', maxWidth: 520 }}>
            <strong>Fix:</strong> In <code>back/.env</code>, set your database password in <code>DATABASE_URL</code>, then run:
            <pre style={{ background: C.paper, padding: 12, borderRadius: 6, overflow: 'auto', fontSize: 13 }}>{`cd back\nnpm run setup-db\nnpm run dev`}</pre>
          </div>
        )}
        <button onClick={() => navigate('/legacy')} style={ghostBtn}>Back</button>
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
      autoStart={(sessionData.savedAnswers?.length ?? 0) > 0}
      interviewStage={sessionData.stage}
      aiVoice={aiVoice}
      tts={aiVoice ? null : browserTts}
      stt={aiVoice ? null : browserStt}
      onAnswerCommit={handleAnswerCommit}
      onComplete={handleComplete}
      onViewAvatar={() => navigate(`/avatar?c=${sessionData.creator.id}`)}
      onViewLegacy={goToUpdatedLegacy}
      onManageAccess={() => navigate('/manage')}
      onBack={() => navigate(`/legacy?c=${sessionData.creator.id}`)}
      processing={processing}
      processingError={processingError}
      onRetryPreservation={retryPreservation}
      extractionResult={extractionResult}
    />
  )
}

/* ──────────────────────────────── Avatar ─────────────────────────────── */
function AvatarPage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const creatorIdParam = params.get('c') || undefined
  const profileRefresh = (location.state as { profileRefresh?: number } | null)?.profileRefresh

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [avatarData, setAvatarData] = useState<ReturnType<typeof mapProfileToAvatarData> | null>(null)
  const [talkCreatorId, setTalkCreatorId] = useState<string | undefined>(creatorIdParam)
  const [canRenderVideo, setCanRenderVideo] = useState(false)
  const [liveReady, setLiveReady] = useState(false)
  const [voiceSampleUrl, setVoiceSampleUrl] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [ownerCreatorId, setOwnerCreatorId] = useState<string | undefined>()
  const [viewerRole, setViewerRole] = useState<Role>('member')

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    Promise.all([
      interviewApi.getProfile(creatorIdParam),
      avatarApi.getAssets({ creatorId: creatorIdParam }).catch(() => null),
    ])
      .then(([profile, assetsRes]) => {
        if (!active) return
        const viewerName =
          session.user.user_metadata?.full_name?.split(' ')[0] ||
          session.user.email?.split('@')[0] ||
          'You'
        const resolvedRole = normalizeRole(profile.role) || 'member'
        const resolvedCreatorId = creatorIdParam || profile.creator?.id || assetsRes?.creatorId
        const data = mapProfileToAvatarData(profile, { name: viewerName, relation: 'family' })
        const portrait =
          assetsRes?.urls?.portrait ||
          assetsRes?.previewUrl ||
          assetsRes?.assets?.metadata?.heygen_avatar_preview_url ||
          null
        if (portrait) data.portraitSrc = portrait
        setAvatarData(data)
        setTalkCreatorId(resolvedCreatorId || undefined)
        setIsOwner(resolvedRole === 'creator')
        setOwnerCreatorId(resolvedCreatorId || undefined)
        setViewerRole(resolvedRole)
        setVoiceSampleUrl(assetsRes?.urls?.voiceSample || null)
        setLiveReady(assetsRes?.liveReady === true)
        const live = assetsRes?.liveReady === true
        // Async HeyGen video is optional; when Live Call is ready, skip it (HeyGen credits often exhausted in dev).
        setCanRenderVideo(Boolean(
          !live
          && resolvedCreatorId
          && assetsRes?.assets?.portrait_path
          && assetsRes?.voiceCloned === true,
        ))
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Failed to load profile') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [session?.user?.id, creatorIdParam, profileRefresh])

  if (!session) return <Navigate to="/" replace />
  if (loading) return <Centered><span style={{ fontFamily: serif, color: C.ink2 }}>Loading your legacy…</span></Centered>

  if (error || !avatarData) {
    return (
      <Centered>
        <p style={{ fontWeight: 600 }}>Could not load avatar</p>
        <p style={{ fontSize: 14, color: C.ink2, textAlign: 'center' }}>{error || 'No profile data yet.'}</p>
        <button onClick={() => navigate('/legacy')} style={primaryBtn}>Back</button>
      </Centered>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {isOwner && (
        <LegacyCreatorNav creatorId={ownerCreatorId} active="avatar" />
      )}
      <LegacyAvatar
        data={avatarData}
        role={viewerRole}
        talkCreatorId={talkCreatorId}
        enableTalkingVideo={canRenderVideo}
        liveReady={liveReady}
        voiceSampleUrl={voiceSampleUrl}
        showCreateAvatar={isOwner}
        onCreateAvatar={() => navigate('/studio')}
        onAsk={(question) => avatarApi.ask(question, talkCreatorId).then((r) => r.answer)}
      />
    </div>
  )
}

/* ──────────────────────────────── Studio ─────────────────────────────── */
function StudioPage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  if (!session) return <Navigate to="/" replace />
  return <AvatarStudio onExit={() => navigate('/legacy')} />
}

/* ──────────────────────────────── Manage ─────────────────────────────── */
function ManagePage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const creatorIdParam = params.get('c') || undefined

  const [resolvedCreatorId, setResolvedCreatorId] = useState<string | undefined>(creatorIdParam)

  useEffect(() => {
    if (!session) return
    accessApi.members(creatorIdParam)
      .then((m) => {
        setResolvedCreatorId(m.creatorId)
      })
      .catch(() => { /* nav falls back to member permissions */ })
  }, [session?.user?.id, creatorIdParam])

  if (!session) return <Navigate to="/" replace />

  return (
    <>
      <LegacyCreatorNav creatorId={resolvedCreatorId} />
      <ManageAccess creatorId={creatorIdParam} onBack={() => navigate(`/legacy${resolvedCreatorId ? `?c=${resolvedCreatorId}` : ''}`)} />
    </>
  )
}

/* ──────────────────────────────── Join ───────────────────────────────── */
const JOIN_ROLE_LABEL: Record<Role, string> = { creator: 'Creator', administrator: 'Administrator', member: 'Member' }

function JoinPage({ session }: { session: Session | null }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [preview, setPreview] = useState<{ role: Role; creatorDisplayName: string | null } | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    accessApi.previewInvite(token)
      .then((p) => setPreview({ role: p.role, creatorDisplayName: p.creatorDisplayName }))
      .catch(() => { /* preview optional — sign-up still works */ })
  }, [token])

  useEffect(() => {
    if (!session || !token) return
    setStatus('working')
    accessApi.acceptInvitation(token)
      .then((res) => navigate(`/legacy?c=${res.creatorId}`, { replace: true }))
      .catch((e) => {
        setStatus('error')
        setMessage(e instanceof Error ? e.message : 'Could not accept invitation')
      })
  }, [session, token, navigate])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthBusy(true)
    setAuthError(null)
    setAuthNotice(null)
    try {
      if (authMode === 'signup') {
        const result = await signUpWithPassword(name, email.trim(), password)
        if (result.needsEmailConfirmation) {
          setAuthNotice('Account created. If email confirmation is enabled, check your inbox — then return to this link and sign in.')
          setAuthMode('signin')
          return
        }
        if (result.session) return // onAuthStateChange → accept invitation
        setAuthNotice('Account created. If email confirmation is enabled, check your inbox — then return to this link and sign in.')
        setAuthMode('signin')
      } else {
        await signInWithPassword(email.trim(), password)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Authentication failed'
      if (msg.toLowerCase().includes('already exists')) {
        setAuthMode('signin')
        setAuthNotice('An account with this email already exists. Sign in below with your password.')
        return
      }
      if (msg.toLowerCase().includes('wrong email')) {
        setAuthError('Wrong email or password. If you already have an account, use the password you created earlier.')
        return
      }
      setAuthError(msg)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setAuthError('Enter your email first, then click forgot password.')
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    try {
      await requestPasswordReset(email.trim(), `${window.location.origin}/join?token=${token}`)
      setAuthNotice('Password reset email sent. Check your inbox, then sign in here.')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Could not send reset email')
    } finally {
      setAuthBusy(false)
    }
  }

  if (!token) return <Centered><p>Invalid invitation link.</p><button onClick={() => navigate('/')} style={ghostBtn}>Home</button></Centered>

  if (!session) {
    const legacyName = preview?.creatorDisplayName || 'a family legacy'
    const roleLabel = preview ? JOIN_ROLE_LABEL[preview.role] : 'family member'
    return (
      <Centered>
        <div style={{ maxWidth: 420, width: '100%' }}>
          <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: C.ink3, margin: 0, textAlign: 'center' }}>Legacy AI invitation</p>
          <p style={{ fontFamily: serif, fontSize: 26, margin: '10px 0 8px', textAlign: 'center' }}>Join {legacyName}</p>
          <p style={{ fontSize: 14, color: C.ink2, textAlign: 'center', margin: '0 0 28px' }}>
            {preview
              ? <>You’ve been invited as <strong>{roleLabel}</strong>. Create an account or sign in — we’ll add you automatically.</>
              : <>Create an account or sign in with this invite link — we’ll add you automatically.</>}
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
            <button type="button" onClick={() => { setAuthMode('signin'); setAuthError(null); setAuthNotice(null) }} style={{ ...ghostBtn, borderColor: authMode === 'signin' ? C.terra : C.line, color: authMode === 'signin' ? C.ink : C.ink2 }}>Sign in</button>
            <button type="button" onClick={() => { setAuthMode('signup'); setAuthError(null); setAuthNotice(null) }} style={{ ...ghostBtn, borderColor: authMode === 'signup' ? C.terra : C.line, color: authMode === 'signup' ? C.ink : C.ink2 }}>Create account</button>
          </div>
          {authNotice && <p style={{ fontSize: 13, color: C.sage, textAlign: 'center', margin: '0 0 16px' }}>{authNotice}</p>}
          {authError && <p style={{ fontSize: 13, color: '#a8503a', textAlign: 'center', margin: '0 0 16px' }}>{authError}</p>}
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {authMode === 'signup' && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required style={joinInput} />
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required style={joinInput} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required minLength={6} style={joinInput} />
            {authMode === 'signin' && (
              <button type="button" onClick={handleForgotPassword} disabled={authBusy} style={{ background: 'none', border: 'none', color: C.ink3, fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                Forgot password?
              </button>
            )}
            <button type="submit" disabled={authBusy} style={{ ...primaryBtn, width: '100%', marginTop: 4 }}>
              {authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account & join' : 'Sign in & join'}
            </button>
          </form>
        </div>
      </Centered>
    )
  }

  return (
    <Centered>
      {status === 'error' ? (
        <>
          <p style={{ fontWeight: 600 }}>Couldn’t join this legacy</p>
          <p style={{ fontSize: 14, color: C.ink2, textAlign: 'center', maxWidth: 440 }}>{message}</p>
          <button onClick={() => navigate('/legacy')} style={primaryBtn}>Continue</button>
        </>
      ) : (
        <span style={{ fontFamily: serif, color: C.ink2 }}>Joining…</span>
      )}
    </Centered>
  )
}

const joinInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: C.card, border: `1px solid ${C.line}`,
  borderRadius: 8, padding: '12px 14px', fontFamily: sans, fontSize: 14, color: C.ink, outline: 'none',
}

/* ──────────────────────────────── App ────────────────────────────────── */
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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage session={session} />} />
        <Route path="/home" element={<Navigate to="/legacy" replace />} />
        <Route path="/legacy" element={<LegacyHomePage session={session} />} />
        <Route path="/interview" element={<InterviewPage session={session} authReady={authReady} />} />
        <Route path="/avatar" element={<AvatarPage session={session} />} />
        <Route path="/studio" element={<StudioPage session={session} />} />
        <Route path="/manage" element={<ManagePage session={session} />} />
        <Route path="/join" element={<JoinPage session={session} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
