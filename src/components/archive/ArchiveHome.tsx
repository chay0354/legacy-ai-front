import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { useArchiveContext } from './data'
import { useSectionNav, type ArchiveOutlet } from './ArchiveLayout'
import AskPortrait from './AskPortrait'
import { ArchiveSetup, NextAction, RecentActivity } from './parts'
import {
  AccessBlock, AskBlock, Band, PeopleBlock, PhotosBlock, StoriesBlock, VoiceBlock, WisdomBlock,
} from './blocks'
import {
  canAsk, canEditArchive, canManageAccess, canRunInterview, canSetUpLiveAvatar, isOwner,
  roleStandfirst, sectionsForRole, type SectionKey,
} from './sections'
import { T, sans } from '../../design/tokens'
import { ASK, CTA, STAGES, STATUS } from '../../design/copy'
import { Body, Btn, Display, Eyebrow, Panel, PrivacyNote } from '../../design/ui'
import { playMedia } from '../../lib/playMedia'

function stageAsk(level: number) {
  if (level >= 3) {
    return {
      eyebrow: STAGES.family.label, title: 'Review and prepare family access',
      note: STAGES.family.note, cta: CTA.review, stage: null as string | null,
    }
  }
  if (level >= 1) {
    return {
      eyebrow: STAGES.enrichment.label, title: 'Pick up where you left off',
      note: STAGES.enrichment.note, cta: CTA.continueInterview,
      stage: level >= 2 ? 'legacy' : 'enriched',
    }
  }
  return {
    eyebrow: STAGES.foundation.label, title: 'Begin the guided interview',
    note: STAGES.foundation.note, cta: CTA.beginInterview, stage: 'foundation',
  }
}

const FALLBACK_QUESTIONS = [
  'What were you proudest of?',
  'Tell me about where you grew up.',
  'How did you meet?',
  'What should I remember?',
]

/**
 * The main screen of the system: every part of the archive on one page.
 * The side navigation scrolls between bands; nothing here edits anything —
 * editing lives on /edit and belongs to the archive owner alone.
 */
export default function ArchiveHome() {
  const { viewerName } = useOutletContext<ArchiveOutlet>()
  const navigate = useNavigate()
  const location = useLocation()
  const ctx = useArchiveContext()
  const sectionNav = useSectionNav()
  const [playing, setPlaying] = useState(false)
  const [liveActive, setLiveActive] = useState(false)
  const [liveKey, setLiveKey] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const nodes = useRef<Partial<Record<SectionKey, HTMLElement>>>({})

  const visible = useMemo(() => sectionsForRole(ctx.role), [ctx.role])
  const has = (key: SectionKey) => visible.some((s) => s.key === key)

  const register = (key: SectionKey) => (el: HTMLElement | null) => {
    if (el) nodes.current[key] = el
    else delete nodes.current[key]
  }

  const scrollTo = useCallback((key: SectionKey) => {
    const el = nodes.current[key]
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 20
    window.scrollTo({ top, behavior: 'smooth' })
    sectionNav.setActive(key)
  }, [sectionNav])

  // Lend the sidebar this screen's scroll function while it is mounted.
  useEffect(() => {
    sectionNav.attach(scrollTo)
    return () => sectionNav.attach(null)
  }, [sectionNav, scrollTo])

  // Deep link: /overview#stories
  useEffect(() => {
    if (!ctx.profile) return
    const key = location.hash.replace('#', '') as SectionKey
    if (!key) return
    const t = window.setTimeout(() => scrollTo(key), 60)
    return () => window.clearTimeout(t)
  }, [ctx.profile, location.hash, scrollTo])

  // Scroll spy for the side navigation.
  useEffect(() => {
    if (!ctx.profile) return
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top?.target instanceof HTMLElement && top.target.id) {
          sectionNav.setActive(top.target.id as SectionKey)
        }
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: [0, .2, .6] },
    )
    Object.values(nodes.current).forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [ctx.profile, ctx.role, sectionNav])

  if (!ctx.profile) return null

  const { profile, role, creatorId, counts, level, setupPct, activity, members } = ctx
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const owner = isOwner(role)
  const ownerName = profile.creator?.display_name || 'This archive'
  const ownerFirst = ownerName.split(' ')[0]
  const voiceUrl = ctx.assets?.urls?.voiceSample || null
  const firstMemory = profile.memories?.[0]
  const liveReady = ctx.assets?.liveReady === true
  const mayAsk = canAsk(role)
  const ask = stageAsk(level)

  const toggleVoice = () => {
    if (!voiceUrl) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio
    if (audio.src !== voiceUrl) audio.src = voiceUrl
    audio.onended = () => setPlaying(false)
    setPlaying(true)
    void playMedia(audio).then(() => {
      if (audio.paused) setPlaying(false)
    })
  }

  const suggestions = (profile.wisdom || [])
    .slice(0, 4)
    .map((w) => (w.life_category
      ? `What did you learn about ${w.life_category.toLowerCase()}?`
      : w.advice_statement))
    .filter(Boolean) as string[]
  while (suggestions.length < 4) suggestions.push(FALLBACK_QUESTIONS[suggestions.length])

  return (
    <>
      <header className="ask-hero" style={{
        display: 'grid', gap: 28, marginBottom: 32,
        gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)', alignItems: 'start',
      }}>
        <AskPortrait
          videoId="archive-overview-live-video"
          name={ownerName}
          portraitSrc={ctx.portraitUrl}
          talkCreatorId={creatorId}
          liveReady={liveReady}
          canChat={mayAsk}
          isOwner={canSetUpLiveAvatar(role)}
          liveActive={liveActive}
          liveKey={liveKey}
          onStartLive={() => { setLiveActive(true); setLiveKey((k) => k + 1) }}
          onEndLive={() => { setLiveActive(false); setLiveKey(0) }}
          onCreateAvatar={() => navigate(`/voice-and-photo${cQuery}`)}
          onAskInWriting={() => navigate(`/ask${cQuery}`)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <Eyebrow>{owner ? 'Your archive' : `${ownerFirst}’s archive`}</Eyebrow>
          <Display size={38}>{owner ? `Welcome back, ${viewerName}.` : ownerName}</Display>
          <Body size={16}>{roleStandfirst(role, ownerFirst)}</Body>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
            {voiceUrl && (
              <Btn tone="quiet" icon="voice" onClick={toggleVoice}>
                {playing ? ASK.pause : ASK.hear}
              </Btn>
            )}
            {mayAsk && (
              <Btn tone="quiet" icon="ask" onClick={() => navigate(`/ask${cQuery}`)}>{ASK.write}</Btn>
            )}
            {canSetUpLiveAvatar(role) && !liveReady && (
              <Btn tone="quiet" icon="live" onClick={() => navigate(`/voice-and-photo${cQuery}`)}>
                {ASK.setup}
              </Btn>
            )}
          </div>
          <PrivacyNote>{STATUS.sourced}. {STATUS.unknown}</PrivacyNote>
        </div>
      </header>

      {has('setup') && (
        <Band
          id="setup" refFn={register('setup')} icon="overview" title="Archive setup"
          count="Where the archive stands"
          action={canRunInterview(role)
            ? (
              <Btn
                icon="interview"
                onClick={() => navigate(ask.stage ? `/interview?stage=${ask.stage}` : `/family-access${cQuery}`)}
              >
                {ask.cta}
              </Btn>
            )
            : undefined}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ArchiveSetup pct={setupPct} level={level} counts={counts} />
            <div className="overview-grid" style={{
              display: 'grid', gap: 16,
              gridTemplateColumns: 'minmax(320px, 1.15fr) minmax(280px, .85fr)', alignItems: 'start',
            }}>
              {canRunInterview(role) ? (
                <NextAction
                  eyebrow={ask.eyebrow} title={ask.title} note={ask.note} cta={ask.cta}
                  onCta={() => navigate(ask.stage ? `/interview?stage=${ask.stage}` : `/family-access${cQuery}`)}
                />
              ) : (
                <Panel pad="22px 24px" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Display size={21}>What you can do here</Display>
                  <Body size={14.5}>
                    {canManageAccess(role)
                      ? `Read everything ${ownerFirst} has recorded, and manage who else can open this archive.`
                      : 'Read the entries, listen to the voice memories, and ask the archive a question.'}
                  </Body>
                  <PrivacyNote>Only invited family can access this</PrivacyNote>
                </Panel>
              )}
              <RecentActivity rows={activity} />
            </div>
            {canEditArchive(role) && (
              <Panel pad="18px 22px" style={{
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                background: T.paperDeep, border: `1px solid ${T.line}`,
              }}>
                <span style={{ fontFamily: sans, fontSize: 14, color: T.ink2 }}>
                  Adding, correcting, and removing happens in one place.
                </span>
                <span style={{ marginLeft: 'auto' }}>
                  <Btn tone="secondary" size="sm" icon="pen" onClick={() => navigate(`/edit${cQuery}`)}>
                    Edit archive
                  </Btn>
                </span>
              </Panel>
            )}
          </div>
        </Band>
      )}

      {has('stories') && (
        <Band
          id="stories" refFn={register('stories')} icon="story" title="Stories"
          count={`${counts.stories} ${counts.stories === 1 ? 'entry' : 'entries'}`}
          note={owner
            ? 'Everything gathered so far, in your own words.'
            : `Entries ${ownerFirst} recorded, in their own words.`}
        >
          <StoriesBlock profile={profile} />
        </Band>
      )}

      {has('voice') && (
        <Band
          id="voice" refFn={register('voice')} icon="voice" title="Voice memories"
          count={voiceUrl ? '1 recording' : 'No recordings yet'}
          note="Kept as a recording, so a story arrives the way it was told."
        >
          <VoiceBlock
            voiceUrl={voiceUrl} playing={playing} onToggle={toggleVoice}
            ownerFirstName={ownerFirst} ownVoice={owner} firstMemory={firstMemory}
          />
        </Band>
      )}

      {has('photos') && (
        <Band
          id="photos" refFn={register('photos')} icon="photo" title="Photos & documents"
          count={`${counts.photographs} ${counts.photographs === 1 ? 'photograph' : 'photographs'}`}
          note="Photographs, letters, and papers that belong with the stories."
        >
          <PhotosBlock profile={profile} />
        </Band>
      )}

      {has('people') && (
        <Band
          id="people" refFn={register('people')} icon="people" title="People"
          count={`${counts.people} ${counts.people === 1 ? 'person' : 'people'}`}
          note="Who belongs to these stories, and how they were described."
        >
          <PeopleBlock profile={profile} />
        </Band>
      )}

      {has('wisdom') && (
        <Band
          id="wisdom" refFn={register('wisdom')} icon="document" title="What you were told"
          count={`${counts.wisdom} ${counts.wisdom === 1 ? 'lesson' : 'lessons'}`}
          note="Advice and values, kept in the words they were given in."
        >
          <WisdomBlock profile={profile} />
        </Band>
      )}

      {has('ask') && (
        <Band
          id="ask" refFn={register('ask')} icon="ask" title="Ask the archive"
          count="Answers from recorded material only"
        >
          <AskBlock suggestions={suggestions} onOpen={() => navigate(`/ask${cQuery}`)} />
        </Band>
      )}

      {has('access') && (
        <Band
          id="access" refFn={register('access')} icon="lock" title="Family Access"
          count={`${Math.max(0, members.length - 1)} invited`}
          note="Who can open this archive. Change or remove access at any time."
        >
          <AccessBlock
            members={members} canManage={canManageAccess(role)}
            onManage={() => navigate(`/family-access${cQuery}`)}
          />
        </Band>
      )}
    </>
  )
}
