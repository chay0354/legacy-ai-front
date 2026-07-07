import React from 'react'
import { ROLES, ROLE_META, ACTIONS, can, normalizeRole, type Role } from '../lib/permissions'
import StageProgressTrack from './StageProgressTrack'
import GallerySection from './GallerySection'

/**
 * Legacy AI — Role-based Home screen.
 * ONE component, three modes. The signed-in user's role selects the screen,
 * and every gated control is rendered through `can(role, ACTIONS.*)` so the
 * three user types can never drift out of sync again.
 *
 * Ported from docs/cursor-roles/RoleHome.jsx (the canonical task package).
 *
 * <RoleHome role={user.role} data={legacy} onTalk={...} />
 */

const C = {
  paper: '#ece3d2', card: '#fbf6ec', ink: '#2b241c', ink2: '#6e6253', ink3: '#9a8d79',
  line: '#ddccb0', cardLine: '#d8cbb0', rowLine: '#e6dcc6',
  terra: '#c06a44', umber: '#7a5236', gold: '#b3902f', sage: '#71805c',
}
const serif = "'Newsreader', Georgia, serif"
const sans = "'Hanken Grotesk', system-ui, sans-serif"
const mono = "'Spline Sans Mono', ui-monospace, monospace"

export interface RoleHomeData {
  subjectName: string
  subjectFull: string
  viewerName: string
  preservedPct: number
  stage: string
  stages: { id: string; label: string; done?: boolean; current?: boolean }[]
  avatarNote: string
  lastSession: string
  creatorActions: { glyph: string; color: string; title: string; note: string; action: string }[]
  memories: { id?: string; title: string; meta: string; color: string; summary?: string; category?: string; year?: string }[]
  gallery: { id: string; imageUrl: string | null; caption: string; title?: string }[]
  admins: { initials: string; name: string; relation: string; color: string }[]
  family: { initials: string; name: string; relation: string; role: Role; status: string; color: string }[]
  suggestions: string[]
  browse: { kicker: string; color: string; title: string; note: string; cta: string }[]
  storyOfDay: { year: string; title: string; quote: string }
}

export interface RoleHomeHandlers {
  onContinueInterview?: () => void
  onPreviewAvatar?: () => void
  onCreateAvatar?: () => void
  onAction?: (action: string) => void
  onAddMemory?: () => void
  onEditMemory?: (m: RoleHomeData['memories'][number]) => void
  onDeleteMemory?: (m: RoleHomeData['memories'][number]) => void
  onUploadPhoto?: () => void
  onDeleteGalleryItem?: (id: string) => void
  onAppointAdmin?: () => void
  onTalk?: () => void
  onInvite?: () => void
  onManageMember?: (f: RoleHomeData['family'][number]) => void
  onAsk?: (q: string) => void
  onBrowse?: (title: string) => void
  onHearStory?: () => void
  onBack?: () => void
  onSignOut?: () => void
}

interface InternalHandlers {
  continueInterview?: () => void
  previewAvatar?: () => void
  createAvatar?: () => void
  action?: (action: string) => void
  addMemory?: () => void
  editMemory?: (m: RoleHomeData['memories'][number]) => void
  deleteMemory?: (m: RoleHomeData['memories'][number]) => void
  uploadPhoto?: () => void
  deleteGalleryItem?: (id: string) => void
  appointAdmin?: () => void
  talk?: () => void
  invite?: () => void
  manage?: (f: RoleHomeData['family'][number]) => void
  ask?: (q: string) => void
  browse?: (title: string) => void
  hearStory?: () => void
  back?: () => void
  signOut?: () => void
}

export const sampleLegacy: RoleHomeData = {
  subjectName: 'Arthur',
  subjectFull: 'Arthur Bellune',
  viewerName: 'Carol',
  preservedPct: 94,
  stage: 'Legacy',
  stages: [
    { id: 'foundation', label: 'Foundation', done: true },
    { id: 'enriched', label: 'Enriched', done: true },
    { id: 'legacy', label: 'Legacy', current: true },
  ],
  avatarNote: 'You’ve recorded 11 sessions. One more on “the people who shaped you” will complete your Relationships layer.',
  lastSession: 'Last session · Aug 2018 · 47 stories preserved',
  creatorActions: [
    { glyph: '❝', color: C.terra, title: 'Continue interview', note: 'Pick up where you left off', action: ACTIONS.COMPLETE_INTERVIEW },
    { glyph: '✚', color: C.umber, title: 'Add a memory', note: 'A story, a photo, a note', action: ACTIONS.ADD_MEMORY },
    { glyph: '❏', color: C.sage, title: 'Upload photos', note: 'Faces, places, letters', action: ACTIONS.UPLOAD_MEDIA },
    { glyph: '♪', color: C.gold, title: 'Record voice', note: 'Family hears you on avatar page', action: ACTIONS.RECORD_VOICE },
  ],
  memories: [
    { title: 'The day the mill closed', meta: 'Story · 1952 · added Mar 14', color: '#a8503a' },
  ],
  gallery: [],
  admins: [
    { initials: 'CB', name: 'Carol Bellune', relation: 'Daughter · Administrator', color: C.sage },
    { initials: 'MB', name: 'Michael Bellune', relation: 'Son · Administrator', color: '#9a6a4b' },
  ],
  family: [
    { initials: 'CB', name: 'Carol Bellune', relation: 'Daughter', role: ROLES.ADMINISTRATOR, status: 'Active', color: C.sage },
    { initials: 'MB', name: 'Maya Bellune', relation: 'Granddaughter', role: ROLES.MEMBER, status: 'Active', color: C.gold },
    { initials: 'JB', name: 'Jonah Bellune', relation: 'Grandson', role: ROLES.MEMBER, status: 'Active', color: '#9a6a4b' },
    { initials: 'RB', name: 'Rosa Bellune', relation: 'Niece', role: ROLES.MEMBER, status: 'Invited', color: '#9a8d79' },
  ],
  suggestions: ['What were you most proud of?', 'How did you meet Grandma?', 'What should I do about my career?', 'Tell me about your father.'],
  browse: [
    { kicker: '47 stories', color: '#a8503a', title: 'Stories', note: 'The moments he kept coming back to.', cta: 'Browse stories' },
    { kicker: '8 chapters', color: C.umber, title: 'His life', note: 'From Braddock, 1934, to the keys he handed on.', cta: 'Walk the timeline' },
    { kicker: '31 lessons', color: C.gold, title: 'Wisdom', note: 'What he wanted you to carry forward.', cta: 'Read his wisdom' },
  ],
  storyOfDay: { year: '1958', title: 'He Almost Didn’t Go', quote: '“She was laughing across the room and I forgot what I was doing. Took me four more dances to say a word.”' },
}

const ROLE_PILL: Partial<Record<Role, { color: string; bg: string; label: string }>> = {
  [ROLES.ADMINISTRATOR]: { color: '#5f6e4d', bg: 'rgba(113,128,92,.14)', label: 'Administrator' },
  [ROLES.MEMBER]: { color: '#96741f', bg: 'rgba(179,144,47,.16)', label: 'Member' },
}
const NAV: Record<Role, string[]> = {
  [ROLES.CREATOR]: ['Home', 'My story', 'Memories', 'People'],
  [ROLES.ADMINISTRATOR]: ['Home', 'Legacy', 'Family & access', 'Talk'],
  [ROLES.MEMBER]: ['Home', 'Stories', 'His life', 'Wisdom'],
}

function injectHead() {
  if (typeof document === 'undefined' || document.getElementById('legacy-rolehome-head')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Hanken+Grotesk:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap'
  document.head.appendChild(link)
  const s = document.createElement('style')
  s.id = 'legacy-rolehome-head'
  s.textContent = `.legacy-rolehome ::selection{background:#c06a44;color:#fbf6ec}`
  document.head.appendChild(s)
}

const cardBox: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 10 }
const eyebrow: React.CSSProperties = { fontFamily: mono, fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: C.ink3 }
const greeting: React.CSSProperties = { fontFamily: serif, fontWeight: 400, fontSize: 38, letterSpacing: '-.015em', margin: '8px 0 0', color: C.ink }
const pill = (x: React.CSSProperties): React.CSSProperties => ({ cursor: 'pointer', fontFamily: sans, fontWeight: 600, borderRadius: 999, whiteSpace: 'nowrap', ...x })

function Avatar({ initials, color, size = 34 }: { initials: string; color: string; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#fbf6ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 14, flex: 'none' }}>{initials}</div>
}

function Nav({ role, on }: { role: Role; on: InternalHandlers }) {
  const meta = ROLE_META[role]
  return (
    <div style={{ height: 62, padding: '0 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.line}`, background: 'rgba(236,227,210,.7)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: on.back ? 'pointer' : 'default' }} onClick={on.back}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1px solid ${C.umber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 13, color: C.umber }}>H</div>
        <div style={{ fontFamily: serif, fontSize: 19, color: C.ink }}>Legacy AI</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26, fontSize: 13.5, color: C.ink2 }}>
        {NAV[role].map((it, i) => <span key={it} style={{ color: i === 0 ? C.ink : C.ink2, fontWeight: i === 0 ? 600 : 400 }}>{it}</span>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: meta.accent, border: `1px solid ${meta.accent}66`, padding: '4px 9px', borderRadius: 999 }}>{meta.label}</span>
        {on.signOut && <span onClick={on.signOut} style={{ fontFamily: sans, fontSize: 12.5, color: C.ink3, cursor: 'pointer' }}>Sign out</span>}
      </div>
    </div>
  )
}

function Shell({ role, on, children }: { role: Role; on: InternalHandlers; children: React.ReactNode }) {
  return (
    <div style={{ ...cardBox, background: C.paper, backgroundImage: 'radial-gradient(900px 460px at 88% -10%, rgba(255,251,242,.7), transparent 60%)', overflow: 'hidden', boxShadow: '0 18px 50px rgba(43,36,28,.14)', border: `1px solid ${C.cardLine}` }}>
      <Nav role={role} on={on} />
      <div style={{ padding: '34px 30px 36px' }}>{children}</div>
    </div>
  )
}

/* ------------------------------- CREATOR --------------------------------- */
function CreatorHome({ role, data: D, on, liveReady, justCompletedStage }: { role: Role; data: RoleHomeData; on: InternalHandlers; liveReady?: boolean; justCompletedStage?: string }) {
  const stageLabel = justCompletedStage
    ? justCompletedStage.charAt(0).toUpperCase() + justCompletedStage.slice(1)
    : null

  return (
    <Shell role={role} on={on}>
      {stageLabel && (
        <div style={{ marginBottom: 18, padding: '14px 18px', background: 'rgba(113,128,92,.14)', border: `1px solid ${C.sage}`, borderRadius: 10, fontSize: 14, color: C.ink, lineHeight: 1.5 }}>
          <strong style={{ color: C.sage }}>{stageLabel} interview preserved.</strong>{' '}
          Your dashboard now includes the stories, people, and wisdom extracted from this session.
        </div>
      )}
      <div style={eyebrow}>Good afternoon</div>
      <h2 style={greeting}>Let’s keep building your legacy, {D.subjectName}.</h2>

      <div style={{ marginTop: 24, background: C.ink, borderRadius: 10, padding: '26px 28px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 28, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.terra }} />
            <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(245,241,234,.6)' }}>Your avatar · {D.preservedPct}% preserved · Stage: {D.stage}</span>
          </div>
          <StageProgressTrack stages={D.stages} variant="dark" margin="18px 0 4px" maxWidth={380} />
          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'rgba(245,241,234,.7)', margin: '14px 0 0', maxWidth: 430 }}>{D.avatarNote}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          {can(role, ACTIONS.CHAT_WITH_AVATAR) && (
            liveReady ? (
              <button onClick={on.talk} style={pill({ border: 'none', background: C.terra, color: '#fbf6ec', fontSize: 14, padding: 13, boxShadow: '0 10px 24px rgba(192,106,68,.3)' })}>Have a live talk with {D.subjectName} →</button>
            ) : can(role, ACTIONS.RECORD_VOICE) ? (
              <button onClick={on.createAvatar} style={pill({ border: 'none', background: C.terra, color: '#fbf6ec', fontSize: 14, padding: 13, boxShadow: '0 10px 24px rgba(192,106,68,.3)' })}>Create your avatar (photo + voice) →</button>
            ) : (
              <button onClick={on.talk} style={pill({ border: 'none', background: C.terra, color: '#fbf6ec', fontSize: 14, padding: 13, boxShadow: '0 10px 24px rgba(192,106,68,.3)' })}>Preview legacy →</button>
            )
          )}
          {D.creatorActions.some((a) => a.action === 'complete_interview') && (
            <button onClick={on.continueInterview} style={pill({ border: '1px solid rgba(245,241,234,.3)', background: 'transparent', color: '#fbf6ec', fontWeight: 500, fontSize: 13, padding: 11 })}>
              {D.creatorActions.find((a) => a.action === 'complete_interview')?.title || 'Continue interview'}
            </button>
          )}
          <button onClick={on.previewAvatar} style={pill({ border: '1px solid rgba(245,241,234,.3)', background: 'transparent', color: '#fbf6ec', fontWeight: 500, fontSize: 13, padding: 11 })}>Preview my avatar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 18 }}>
        {D.creatorActions.filter((a) => can(role, a.action as never)).map((a) => (
          <div key={a.title} onClick={() => on.action?.(a.action)} style={{ ...cardBox, borderRadius: 9, padding: '18px 16px', cursor: 'pointer' }}>
            <div style={{ fontFamily: serif, fontSize: 24, color: a.color }}>{a.glyph}</div>
            <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 14, color: C.ink, marginTop: 10 }}>{a.title}</div>
            <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.4, marginTop: 3 }}>{a.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginTop: 24 }}>
        <div style={{ ...cardBox, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>Your memories</div>
            {can(role, ACTIONS.ADD_MEMORY) && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); on.addMemory?.(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on.addMemory?.(); } }}
                style={{ fontFamily: sans, fontSize: 12.5, fontWeight: 600, color: C.terra, cursor: 'pointer' }}
              >
                + Add a memory
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            {D.memories.length === 0 && <div style={{ fontSize: 13.5, color: C.ink3 }}>No memories yet — your interview answers will appear here.</div>}
            {D.memories.map((m) => (
              <div key={m.id || m.title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: `1px solid ${C.rowLine}`, borderRadius: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, flex: 'none', background: m.color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: serif, fontSize: 16, color: C.ink, lineHeight: 1.15 }}>{m.title}</div>
                  <div style={{ fontFamily: mono, fontSize: 10.5, color: C.ink3, marginTop: 2 }}>{m.meta}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {can(role, ACTIONS.EDIT_MEMORY) && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => on.editMemory?.(m)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on.editMemory?.(m); } }}
                      style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: C.ink2, cursor: 'pointer' }}
                    >
                      ✎
                    </span>
                  )}
                  {can(role, ACTIONS.DELETE_MEMORY) && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => on.deleteMemory?.(m)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on.deleteMemory?.(m); } }}
                      style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#b04a3a', cursor: 'pointer' }}
                    >
                      ⌫
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardBox, padding: '22px 24px' }}>
          <div style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>Administrators</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: C.ink2, margin: '6px 0 16px' }}>People you trust to manage access. They can invite family — but never edit your memories.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {D.admins.length === 0 && <div style={{ fontSize: 12.5, color: C.ink3 }}>No administrators yet.</div>}
            {D.admins.map((ad) => (
              <div key={ad.name} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar initials={ad.initials} color={ad.color} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, color: C.ink }}>{ad.name}</div><div style={{ fontSize: 11.5, color: C.ink3 }}>{ad.relation}</div></div>
              </div>
            ))}
          </div>
          {can(role, ACTIONS.APPOINT_ADMIN) && <button onClick={on.appointAdmin} style={{ marginTop: 16, width: '100%', cursor: 'pointer', border: '1px dashed #c9b894', background: 'transparent', color: C.umber, fontFamily: sans, fontWeight: 600, fontSize: 13, padding: 11, borderRadius: 9 }}>+ Appoint an administrator</button>}
        </div>
      </div>

      <GallerySection
        role={role}
        items={D.gallery}
        onUpload={can(role, ACTIONS.UPLOAD_MEDIA) ? on.uploadPhoto : undefined}
        onDelete={can(role, ACTIONS.UPLOAD_MEDIA) ? on.deleteGalleryItem : undefined}
      />

      {can(role, ACTIONS.RECORD_VOICE) && (
        <div style={{ marginTop: 24, background: C.ink, borderRadius: 12, padding: '28px 30px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: C.terra }}>
              {liveReady ? 'Avatar active' : 'The heart of your legacy'}
            </div>
            <div style={{ fontFamily: serif, fontSize: 26, color: '#fbf6ec', lineHeight: 1.2, marginTop: 8 }}>
              {liveReady ? 'Your living avatar is ready' : 'Create your living avatar'}
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(245,241,234,.72)', margin: '8px 0 0', maxWidth: 460 }}>
              {liveReady ? (
                <>
                  Your photo and voice are set up for live calls — family can talk with you in real time, face and voice.
                  Want a fresh look or a new voice sample? Recreate your avatar anytime.
                </>
              ) : (
                <>
                  Record your voice once and take a photo — we turn that into a live avatar for real-time calls.
                  Your legacy answers in your own voice, with your face.
                </>
              )}
            </p>
          </div>
          {liveReady ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              {can(role, ACTIONS.CHAT_WITH_AVATAR) && (
                <button onClick={on.talk} style={pill({ border: 'none', background: C.terra, color: '#fbf6ec', fontSize: 15, padding: '15px 22px', boxShadow: '0 10px 24px rgba(192,106,68,.3)' })}>
                  Have a live talk →
                </button>
              )}
              <button onClick={on.createAvatar} style={pill({ border: '1px solid rgba(245,241,234,.35)', background: 'transparent', color: '#fbf6ec', fontWeight: 500, fontSize: 13, padding: '13px 18px' })}>
                Recreate avatar (new photo + voice) →
              </button>
            </div>
          ) : (
            <button onClick={on.createAvatar} style={pill({ border: 'none', background: C.terra, color: '#fbf6ec', fontSize: 15, padding: '15px 22px', boxShadow: '0 10px 24px rgba(192,106,68,.3)' })}>
              Create my avatar →
            </button>
          )}
        </div>
      )}
    </Shell>
  )
}

/* ---------------------------- ADMINISTRATOR ------------------------------ */
function AdministratorHome({ role, data: D, on }: { role: Role; data: RoleHomeData; on: InternalHandlers }) {
  return (
    <Shell role={role} on={on}>
      <div style={eyebrow}>Welcome back</div>
      <h2 style={greeting}>You’re looking after {D.subjectName}’s legacy, {D.viewerName}.</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 24 }}>
        <div style={{ ...cardBox, padding: '24px 26px', display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ width: 84, height: 104, borderRadius: 5, background: '#e4d8c2', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontStyle: 'italic', fontSize: 11, color: C.ink3, textAlign: 'center', padding: 6 }}>{D.subjectName}’s portrait</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: C.sage }} /><span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: C.sage }}>Avatar active · {D.preservedPct}% preserved</span></div>
            <div style={{ fontFamily: serif, fontSize: 26, color: C.ink, marginTop: 8 }}>{D.subjectFull}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.ink3, marginTop: 3 }}>{D.lastSession}</div>
            {!can(role, ACTIONS.EDIT_MEMORY) && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 14, background: '#f1ead9', border: `1px solid ${C.rowLine}`, borderRadius: 999, padding: '6px 12px' }}>
                <span style={{ fontSize: 12 }}>🔒</span><span style={{ fontSize: 11.5, color: C.ink2 }}>View only — only {D.subjectName} can edit their memories</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ background: C.ink, borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: serif, fontSize: 21, color: '#fbf6ec', lineHeight: 1.2 }}>Spend a moment with {D.subjectName}</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(245,241,234,.7)', margin: '8px 0 16px' }}>Ask anything — they answer in their own voice.</p>
          {can(role, ACTIONS.CHAT_WITH_AVATAR) && <button onClick={on.talk} style={pill({ border: 'none', background: C.terra, color: '#fbf6ec', fontSize: 14, padding: 12 })}>Talk with {D.subjectName} →</button>}
        </div>
      </div>

      <GallerySection role={role} items={D.gallery} />

      <div style={{ ...cardBox, padding: '24px 26px', marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
          <div style={{ flex: 'none', whiteSpace: 'nowrap', fontFamily: serif, fontSize: 22, color: C.ink }}>Family &amp; access</div>
          {can(role, ACTIONS.INVITE_USER) && <button onClick={on.invite} style={pill({ flex: 'none', whiteSpace: 'nowrap', border: 'none', background: C.sage, color: '#fbf6ec', fontSize: 13, padding: '10px 18px' })}>+ Invite a family member</button>}
        </div>
        <p style={{ fontSize: 12.5, color: C.ink2, margin: '0 0 18px' }}>Manage who can visit {D.subjectName}’s legacy and what they can do.</p>
        <div>
          {D.family.map((f) => {
            const rp = ROLE_PILL[f.role] || { color: C.ink3, bg: 'rgba(154,141,121,.16)', label: f.role }
            return (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: `1px solid ${C.rowLine}` }}>
                <Avatar initials={f.initials} color={f.color} size={36} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, color: C.ink }}>{f.name}</div><div style={{ fontSize: 11.5, color: C.ink3 }}>{f.relation}</div></div>
                <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: rp.color, background: rp.bg, padding: '5px 12px', borderRadius: 999 }}>{rp.label}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: C.ink3, width: 78, textAlign: 'right' }}>{f.status}</span>
                {can(role, ACTIONS.MANAGE_ACCESS) && <span onClick={() => on.manage?.(f)} style={{ width: 28, textAlign: 'center', color: C.ink3, cursor: 'pointer' }}>⋯</span>}
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}

/* -------------------------------- MEMBER --------------------------------- */
function MemberHome({ role, data: D, on }: { role: Role; data: RoleHomeData; on: InternalHandlers }) {
  return (
    <Shell role={role} on={on}>
      <div style={{ background: C.ink, borderRadius: 12, padding: '34px 34px', display: 'grid', gridTemplateColumns: '1fr 240px', gap: 26, alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(245,241,234,.55)' }}>Welcome, {D.viewerName}</div>
          <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 36, lineHeight: 1.08, letterSpacing: '-.015em', margin: '12px 0 0', color: '#fbf6ec' }}>{D.subjectName} is here whenever you’d like to talk.</h2>
          <p style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 17, lineHeight: 1.5, color: 'rgba(245,241,234,.72)', margin: '14px 0 0' }}>“Pull up a chair. Ask me anything you like.”</p>
          {can(role, ACTIONS.CHAT_WITH_AVATAR) && <button onClick={on.talk} style={pill({ marginTop: 22, border: 'none', background: C.terra, color: '#fbf6ec', fontSize: 15, padding: '15px 28px', boxShadow: '0 10px 24px rgba(192,106,68,.3)' })}>Talk with {D.subjectName} →</button>}
        </div>
        <div style={{ aspectRatio: '4 / 5', borderRadius: 8, background: '#e4d8c2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontStyle: 'italic', fontSize: 12, color: C.ink3, textAlign: 'center', padding: 10 }}>A portrait of {D.subjectName}</div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: C.ink3, marginBottom: 11 }}>Not sure where to start? Try asking</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {D.suggestions.map((q) => <span key={q} onClick={() => on.ask?.(q)} style={{ cursor: 'pointer', ...cardBox, borderRadius: 999, padding: '10px 16px', fontSize: 13.5, color: C.ink }}>{q}</span>)}
        </div>
      </div>

      <GallerySection role={role} items={D.gallery} />

      <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: serif, fontSize: 22, color: C.ink }}>Wander through their life</div>
        <span style={{ fontSize: 13, color: C.ink3 }}>View only · nothing to manage</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 16 }}>
        {D.browse.map((b) => (
          <div key={b.title} onClick={() => on.browse?.(b.title)} style={{ ...cardBox, padding: '22px 22px', cursor: 'pointer' }}>
            <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: b.color }}>{b.kicker}</div>
            <div style={{ fontFamily: serif, fontSize: 22, color: C.ink, lineHeight: 1.15, marginTop: 10 }}>{b.title}</div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: C.ink2, margin: '8px 0 14px' }}>{b.note}</p>
            <span style={{ fontFamily: sans, fontSize: 12.5, fontWeight: 600, color: C.terra }}>{b.cta} →</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, ...cardBox, padding: '24px 26px', display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: C.terra }}>Story of the day · {D.storyOfDay.year}</div>
          <div style={{ fontFamily: serif, fontSize: 23, color: C.ink, marginTop: 8 }}>{D.storyOfDay.title}</div>
          <p style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 16, lineHeight: 1.5, color: C.ink2, margin: '8px 0 0' }}>{D.storyOfDay.quote}</p>
        </div>
        <button onClick={on.hearStory} style={{ cursor: 'pointer', flex: 'none', border: `1px solid ${C.ink}`, background: 'transparent', color: C.ink, fontFamily: sans, fontWeight: 600, fontSize: 13, padding: '12px 20px', borderRadius: 999 }}>Hear {D.subjectName} tell it</button>
      </div>
    </Shell>
  )
}

const SCREENS: Record<Role, (p: { role: Role; data: RoleHomeData; on: InternalHandlers; liveReady?: boolean; justCompletedStage?: string }) => React.JSX.Element> = {
  [ROLES.CREATOR]: CreatorHome,
  [ROLES.ADMINISTRATOR]: AdministratorHome,
  [ROLES.MEMBER]: MemberHome,
}

export default function RoleHome({ role: rawRole = ROLES.CREATOR, data = sampleLegacy, liveReady, justCompletedStage, ...handlers }: { role?: Role | string; data?: RoleHomeData; liveReady?: boolean; justCompletedStage?: string } & RoleHomeHandlers) {
  injectHead()
  const role = normalizeRole(rawRole) || ROLES.MEMBER // deny-by-default: unknown → least privilege
  const Screen = SCREENS[role] || MemberHome
  const on: InternalHandlers = {
    continueInterview: handlers.onContinueInterview,
    previewAvatar: handlers.onPreviewAvatar,
    createAvatar: handlers.onCreateAvatar,
    action: handlers.onAction,
    addMemory: handlers.onAddMemory,
    editMemory: handlers.onEditMemory,
    deleteMemory: handlers.onDeleteMemory,
    uploadPhoto: handlers.onUploadPhoto,
    deleteGalleryItem: handlers.onDeleteGalleryItem,
    appointAdmin: handlers.onAppointAdmin,
    talk: handlers.onTalk,
    invite: handlers.onInvite,
    manage: handlers.onManageMember,
    ask: handlers.onAsk,
    browse: handlers.onBrowse,
    hearStory: handlers.onHearStory,
    back: handlers.onBack,
    signOut: handlers.onSignOut,
  }
  return (
    <div className="legacy-rolehome" style={{ minHeight: '100vh', padding: 40, boxSizing: 'border-box', background: '#e3dccd', fontFamily: sans, WebkitFontSmoothing: 'antialiased', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1040 }}>
        <Screen role={role} data={data} on={on} liveReady={liveReady} justCompletedStage={justCompletedStage} />
      </div>
    </div>
  )
}

export { CreatorHome, AdministratorHome, MemberHome }
