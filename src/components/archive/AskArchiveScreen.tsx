import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useArchiveContext } from './data'
import type { ArchiveOutlet } from './ArchiveLayout'
import AskPortrait from './AskPortrait'
import { EmptyState, SectionHeader } from './parts'
import { avatarApi } from '../../lib/api'
import { ACTIONS, can } from '../../lib/permissions'
import { ASK, NAV, STATUS, TRUST } from '../../design/copy'
import { T, radius, sans, serif } from '../../design/tokens'
import { Body, Btn, Display, Eyebrow, ImageSlot, Meta, Panel, PrivacyNote } from '../../design/ui'
import { playMedia } from '../../lib/playMedia'

export default function AskArchiveScreen() {
  const ctx = useArchiveContext()
  const { viewerName } = useOutletContext<ArchiveOutlet>()
  const navigate = useNavigate()
  const askRef = useRef<HTMLFormElement | null>(null)
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)
  const sampleRef = useRef<HTMLAudioElement | null>(null)

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [question, setQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [voiceNote, setVoiceNote] = useState('')
  const [hearing, setHearing] = useState(false)
  const [liveActive, setLiveActive] = useState(false)
  const [liveKey, setLiveKey] = useState(0)

  useEffect(() => () => {
    voiceAudioRef.current?.pause()
    sampleRef.current?.pause()
  }, [])

  if (!ctx.profile) return null

  const { role, creatorId, profile, portraitUrl } = ctx
  const mayEdit = can(role, ACTIONS.EDIT_PROFILE)
  const mayInterview = can(role, ACTIONS.COMPLETE_INTERVIEW)
  const canChat = can(role, ACTIONS.CHAT_WITH_AVATAR)
  const liveReady = ctx.assets?.liveReady === true
  const voiceCloned = ctx.assets?.voiceCloned === true
  const voiceSampleUrl = ctx.assets?.urls?.voiceSample || null
  const name = profile.creator?.display_name || 'This archive'
  const firstName = name.split(' ')[0]
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const memories = profile.memories || []
  const people = profile.relationships || []
  const gallery = profile.gallery || []
  const wisdom = profile.wisdom || []
  const values = profile.values || []
  const intro = profile.latestSessionSummary
    || profile.session_summary
    || (mayEdit
      ? 'Stories, voice, and photographs you have chosen to keep — ready for the people you invite.'
      : `Stories, voice, and photographs kept for ${firstName}’s family.`)

  const prompts = [
    ...wisdom.slice(0, 2).map((w) =>
      w.life_category ? `What was said about ${w.life_category.toLowerCase()}?` : 'What advice was kept here?',
    ),
    ...memories.slice(0, 2).map((m) => `Tell me about ${m.title || 'this story'}`),
  ].slice(0, 4)

  const playCloned = (url: string) => {
    voiceAudioRef.current?.pause()
    const a = new Audio(url)
    voiceAudioRef.current = a
    void playMedia(a)
  }

  const speakAnswer = (text: string) => {
    if (!voiceCloned || !text || !creatorId) return
    voiceAudioRef.current?.pause()
    setVoiceNote(ASK.speaking)
    avatarApi.playSpeech(text, creatorId, {
      onAudio: (url) => { playCloned(url); setVoiceNote('') },
      onNotice: (notice) => setVoiceNote(notice),
    }).catch((e) => {
      setVoiceNote(e instanceof Error ? e.message : 'Could not play voice')
    })
  }

  const submit = async (raw?: string) => {
    const q = (raw ?? input).trim()
    if (!q || busy || !canChat) return
    setInput('')
    setQuestion(q)
    setAnswer(null)
    setBusy(true)
    setVoiceNote(ASK.thinking)
    try {
      const res = await avatarApi.ask(q, creatorId)
      const a = res.answer || STATUS.unknown
      setAnswer(a)
      speakAnswer(a)
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : STATUS.unknown)
      setVoiceNote('')
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit()
  }

  const toggleSample = () => {
    if (!voiceSampleUrl) return
    if (hearing) {
      sampleRef.current?.pause()
      setHearing(false)
      return
    }
    voiceAudioRef.current?.pause()
    const audio = sampleRef.current || new Audio(voiceSampleUrl)
    sampleRef.current = audio
    audio.src = voiceSampleUrl
    audio.onended = () => setHearing(false)
    void playMedia(audio).then(() => { if (!audio.paused) setHearing(true) })
  }

  const startLive = () => {
    setLiveActive(true)
    setLiveKey((k) => k + 1)
  }

  const focusAsk = () => {
    askRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    askRef.current?.querySelector('input')?.focus()
  }

  return (
    <>
      <SectionHeader
        eyebrow={ASK.eyebrow}
        title={ASK.title}
        note={mayEdit ? ASK.ownerNote : ASK.familyNote}
      />

      <div className="ask-hero" style={{
        display: 'grid', gap: 28, marginBottom: 28,
        gridTemplateColumns: 'minmax(240px, 320px) minmax(0, 1fr)',
        alignItems: 'start',
      }}>
        <AskPortrait
          name={name}
          portraitSrc={portraitUrl}
          talkCreatorId={creatorId}
          liveReady={liveReady}
          canChat={canChat}
          isOwner={mayEdit}
          liveActive={liveActive}
          liveKey={liveKey}
          onStartLive={startLive}
          onEndLive={() => { setLiveActive(false); setLiveKey(0) }}
          onCreateAvatar={() => navigate(`/voice-and-photo${cQuery}`)}
          onAskInWriting={focusAsk}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Eyebrow>{viewerName ? `Opened by ${viewerName}` : 'Private archive'}</Eyebrow>
          <Display size={40}>{name}</Display>
          <Body size={17} style={{ maxWidth: 560 }}>{intro}</Body>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {voiceSampleUrl && (
              <Btn tone="quiet" icon="voice" onClick={toggleSample}>
                {hearing ? ASK.pause : ASK.hear}
              </Btn>
            )}
            {canChat && (
              <Btn tone="quiet" icon="ask" onClick={focusAsk}>{ASK.write}</Btn>
            )}
            {mayEdit && !liveReady && (
              <Btn tone="quiet" icon="live" onClick={() => navigate(`/voice-and-photo${cQuery}`)}>
                {ASK.setup}
              </Btn>
            )}
          </div>
          <PrivacyNote>{STATUS.sourced}. {STATUS.unknown}</PrivacyNote>
        </div>
      </div>

      {canChat && (
        <Panel pad="22px 24px" style={{ marginBottom: 22 }}>
          <Display size={22} style={{ marginBottom: 8 }}>Ask in writing</Display>
          <Body size={14.5} style={{ marginBottom: 16, maxWidth: 560 }}>
            {STATUS.sourced}. {STATUS.unknown}
          </Body>
          <form ref={askRef} onSubmit={onSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ASK.placeholder}
              disabled={busy}
              style={{
                flex: '1 1 240px', minWidth: 0, boxSizing: 'border-box',
                background: T.paper, border: `1px solid ${T.line}`, borderRadius: radius.sm,
                padding: '11px 14px', fontFamily: sans, fontSize: 15, color: T.ink, outline: 'none',
              }}
            />
            <Btn type="submit" disabled={busy || !input.trim()}>{busy ? ASK.thinking : ASK.send}</Btn>
          </form>
          {prompts.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => void submit(p)}
                  style={{
                    background: 'transparent', border: `1px solid ${T.line}`, color: T.ink2,
                    fontFamily: sans, fontSize: 13, padding: '7px 12px', borderRadius: radius.pill,
                    cursor: busy ? 'default' : 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          {(question || answer) && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {question && (
                <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3 }}>You asked · {question}</span>
              )}
              {answer && (
                <p style={{
                  fontFamily: serif, fontSize: 20, lineHeight: 1.45, color: T.ink, margin: 0,
                }}>
                  {answer}
                </p>
              )}
              {voiceNote && <Eyebrow>{voiceNote}</Eyebrow>}
            </div>
          )}
        </Panel>
      )}

      {memories.length === 0 && people.length === 0 && gallery.length === 0 ? (
        <EmptyState
          icon="ask"
          title={ASK.empty}
          note={mayInterview
            ? 'Begin with a guided interview, then add stories, voice, and photographs.'
            : 'When entries are added, they will appear here.'}
          cta={mayInterview ? 'Begin interview' : undefined}
          onCta={mayInterview ? () => navigate('/interview') : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {memories.length > 0 && (
            <Panel pad="22px 24px">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', marginBottom: 14 }}>
                <Display size={22}>Stories</Display>
                <Btn tone="quiet" size="sm" onClick={() => navigate(`/overview${cQuery}#stories`)}>{NAV.stories}</Btn>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {memories.slice(0, 4).map((m, i) => (
                  <div key={m.id || i} style={{
                    padding: '14px 0',
                    borderTop: i === 0 ? 'none' : `1px solid ${T.lineSoft}`,
                  }}>
                    <Meta items={[m.category, m.year]} />
                    <div style={{ fontFamily: serif, fontSize: 20, color: T.ink, marginTop: 4 }}>
                      {m.title || 'Untitled entry'}
                    </div>
                    {m.summary && (
                      <Body size={14.5} style={{ marginTop: 6, maxWidth: 640 }}>{m.summary}</Body>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {people.length > 0 && (
            <Panel pad="22px 24px">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', marginBottom: 14 }}>
                <Display size={22}>People</Display>
                <Btn tone="quiet" size="sm" onClick={() => navigate(`/overview${cQuery}#people`)}>{NAV.people}</Btn>
              </div>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {people.slice(0, 6).map((p) => (
                  <div key={p.name} style={{
                    border: `1px solid ${T.lineSoft}`, borderRadius: radius.sm, padding: '14px 16px',
                  }}>
                    <div style={{ fontFamily: serif, fontSize: 18, color: T.ink }}>{p.name}</div>
                    {p.relationship_type && <Eyebrow style={{ marginTop: 6 }}>{p.relationship_type}</Eyebrow>}
                    {(p.relationship_summary || p.description) && (
                      <Body size={13.5} style={{ marginTop: 8 }}>{p.relationship_summary || p.description}</Body>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {gallery.length > 0 && (
            <Panel pad="22px 24px">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', marginBottom: 14 }}>
                <Display size={22}>Photographs</Display>
                <Btn tone="quiet" size="sm" onClick={() => navigate(`/overview${cQuery}#photos`)}>{NAV.photos}</Btn>
              </div>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {gallery.slice(0, 6).map((g) => (
                  <figure key={g.id} style={{ margin: 0 }}>
                    <ImageSlot label={g.title || g.caption || 'Photograph'} height={140} src={g.imageUrl} />
                    {(g.title || g.caption) && (
                      <figcaption style={{ fontFamily: sans, fontSize: 13, color: T.ink3, marginTop: 8 }}>
                        {g.title || g.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </Panel>
          )}

          {(wisdom.length > 0 || values.length > 0) && (
            <Panel pad="22px 24px">
              <Display size={22} style={{ marginBottom: 14 }}>Kept in the archive</Display>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {wisdom.slice(0, 3).map((w, i) => (
                  <blockquote key={i} style={{ margin: 0, paddingLeft: 16, borderLeft: `2px solid ${T.gold}` }}>
                    <p style={{ fontFamily: serif, fontSize: 18, lineHeight: 1.45, color: T.ink, margin: 0 }}>
                      {w.advice_statement}
                    </p>
                    {(w.life_category || w.supporting_story) && (
                      <Body size={13} style={{ marginTop: 6 }}>{w.life_category || w.supporting_story}</Body>
                    )}
                  </blockquote>
                ))}
                {values.slice(0, 3).map((v) => (
                  <div key={v.value_name}>
                    <Eyebrow>{v.is_core ? 'Core' : 'Value'}</Eyebrow>
                    <div style={{ fontFamily: serif, fontSize: 18, color: T.ink, marginTop: 4 }}>{v.value_name}</div>
                    {v.description && <Body size={14} style={{ marginTop: 4 }}>{v.description}</Body>}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      <div style={{
        marginTop: 22, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <PrivacyNote>Only invited family can access this</PrivacyNote>
        <span style={{ fontFamily: sans, fontSize: 13, color: T.ink3 }}>{TRUST[2]}</span>
      </div>
    </>
  )
}
