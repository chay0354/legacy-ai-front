import { useEffect, useState } from 'react'
import ArchiveShell from './ArchiveShell'
import { Loading } from './parts'
import LegacyAvatar from '../LegacyAvatar'
import { avatarApi, interviewApi, type AvatarAssetsResponse, type Role } from '../../lib/api'
import { mapProfileToAvatarData } from '../../lib/mapAvatarData'
import { normalizeRole } from '../../lib/permissions'
import { T, sans } from '../../design/tokens'
import { STATUS } from '../../design/copy'
import { Display, Eyebrow, Icon } from '../../design/ui'

/**
 * "Ask the archive" — the reading and listening surface for invited family.
 * Answers come only from recorded archive material; when the archive does not
 * know, it says so.
 */
export default function AskArchiveScreen({
  creatorIdParam, viewerName,
}: { creatorIdParam?: string; viewerName: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ReturnType<typeof mapProfileToAvatarData> | null>(null)
  const [assets, setAssets] = useState<AvatarAssetsResponse | null>(null)
  const [role, setRole] = useState<Role>('member')
  const [creatorId, setCreatorId] = useState<string | undefined>(creatorIdParam)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      interviewApi.getProfile(creatorIdParam),
      avatarApi.getAssets({ creatorId: creatorIdParam }).catch(() => null),
    ])
      .then(([profile, a]) => {
        if (!active) return
        const mapped = mapProfileToAvatarData(profile, { name: viewerName, relation: 'family' })
        const portrait = a?.urls?.portrait || a?.previewUrl || null
        if (portrait) mapped.portraitSrc = portrait
        setData(mapped)
        setAssets(a)
        setRole((normalizeRole(profile.role) || 'member') as Role)
        setCreatorId(creatorIdParam || profile.creator?.id || a?.creatorId || undefined)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not open this archive')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [creatorIdParam, viewerName])

  if (loading) return <Loading label="Opening the archive…" />
  if (error || !data) return <Loading label={error || 'Nothing here yet.'} />

  const isOwner = normalizeRole(role) === 'creator'

  return (
    <ArchiveShell
      active="ask" role={role} creatorId={creatorId}
      creatorName={data.name} portraitUrl={assets?.urls?.portrait || null}
      band={false} contentMax={1320}
    >
      <header style={{ marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>The archive</Eyebrow>
        <Display size={33}>Ask the archive</Display>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: sans, fontSize: 13.5, color: T.ink3,
        }}>
          <Icon name="lock" size={15} color={T.ink3} strokeWidth={1.3} />
          {STATUS.sourced}. {STATUS.unknown}
        </span>
      </header>

      <LegacyAvatar
        data={data}
        role={role}
        talkCreatorId={creatorId}
        enableTalkingVideo={Boolean(
          creatorId && assets?.assets?.portrait_path && assets?.voiceCloned === true,
        )}
        liveReady={assets?.liveReady === true}
        voiceSampleUrl={assets?.urls?.voiceSample || null}
        showCreateAvatar={false}
        onAsk={(question) => avatarApi.ask(question, creatorId).then((r) => r.answer)}
      />

      {isOwner && (
        <p style={{ fontFamily: sans, fontSize: 13, color: T.ink3, marginTop: 18 }}>
          This is what invited family sees. Add voice and a photograph in Settings to make answers
          sound more like you.
        </p>
      )}
    </ArchiveShell>
  )
}
