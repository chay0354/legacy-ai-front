import { useEffect, useState } from 'react'
import { authHeaders } from '../../lib/api'
import { apiUrl } from '../../lib/apiUrl'
import { ASK } from '../../design/copy'
import { T, radius, sans, serif, shadow } from '../../design/tokens'
import { Body, Btn, Eyebrow, Icon } from '../../design/ui'
import { useAnamLiveCall } from '../LiveAvatarCall'

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 2) || '—'
}

export default function AskPortrait({
  name,
  portraitSrc,
  talkCreatorId,
  liveReady,
  canChat,
  isOwner,
  liveActive,
  liveKey,
  onStartLive,
  onEndLive,
  onCreateAvatar,
  onAskInWriting,
  videoId = 'archive-ask-live-video',
}: {
  name: string
  portraitSrc?: string | null
  talkCreatorId?: string
  liveReady: boolean
  canChat: boolean
  isOwner: boolean
  liveActive: boolean
  liveKey: number
  onStartLive: () => void
  onEndLive: () => void
  onCreateAvatar?: () => void
  onAskInWriting?: () => void
  /** Unique per mounted portrait, so two surfaces never share one video element. */
  videoId?: string
}) {
  const live = useAnamLiveCall(talkCreatorId, videoId, liveKey)
  const videoLive = live.videoReady
  const [broken, setBroken] = useState(false)
  const [proxy, setProxy] = useState<string | null>(null)
  const src = broken ? null : (portraitSrc || proxy || null)

  useEffect(() => {
    setBroken(false)
    setProxy(null)
  }, [portraitSrc, talkCreatorId])

  useEffect(() => {
    if (portraitSrc || !talkCreatorId || broken) return
    let cancelled = false
    let objectUrl: string | null = null
    void (async () => {
      try {
        const headers = await authHeaders()
        const res = await fetch(
          apiUrl(`/api/avatar/portrait?creatorId=${encodeURIComponent(talkCreatorId)}`),
          { headers },
        )
        if (!res.ok || cancelled) return
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setProxy(objectUrl)
      } catch { /* portrait proxy unavailable */ }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [portraitSrc, talkCreatorId, broken])

  const handleEnd = async () => {
    await live.hangUp()
    onEndLive()
  }

  return (
    <div id="portrait-live" style={{
      background: T.card, border: `1px solid ${T.cardEdge}`, borderRadius: radius.md,
      padding: 10, boxShadow: shadow.panel,
    }}>
      <div style={{
        width: '100%', aspectRatio: '2 / 3', background: T.paperDeep,
        position: 'relative', overflow: 'hidden', borderRadius: radius.sm,
      }}>
        {src ? (
          <img
            src={src}
            alt=""
            onError={() => setBroken(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              opacity: liveActive && videoLive ? 0 : 1,
              transition: 'opacity .55s ease',
            }}
          />
        ) : !liveActive ? (
          <div style={{
            width: '100%', height: '100%', display: 'grid', placeItems: 'center',
            background: `linear-gradient(160deg, ${T.paperDeep} 0%, ${T.card} 100%)`,
          }}>
            <span style={{
              width: 56, height: 56, borderRadius: radius.pill,
              border: `1px solid ${T.cardEdge}`, background: T.card,
              display: 'grid', placeItems: 'center',
              fontFamily: serif, fontSize: 16, color: T.ink3, letterSpacing: '.04em',
            }}>{initials(name)}</span>
          </div>
        ) : null}

        {!liveActive && liveReady && canChat && (
          <button
            type="button" onClick={onStartLive} title={ASK.talk} aria-label={ASK.talk}
            style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              border: 'none', padding: 0, cursor: 'pointer', background: 'transparent',
            }}
          >
            <span style={{
              width: 58, height: 58, borderRadius: radius.pill, display: 'grid', placeItems: 'center',
              background: T.ink, border: `1px solid ${T.cardEdge}`,
              boxShadow: '0 8px 22px rgba(30,23,18,.28)',
            }}>
              <Icon name="play" size={22} color={T.onDark} strokeWidth={1.1} style={{ marginLeft: 3 }} />
            </span>
          </button>
        )}

        {liveActive && (
          <>
            <video
              id={videoId}
              autoPlay
              playsInline
              disablePictureInPicture
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', display: 'block', background: 'transparent',
                opacity: videoLive ? 1 : 0, transition: 'opacity .55s ease',
                pointerEvents: videoLive ? 'auto' : 'none',
                transform: 'translateZ(0)',
              }}
            />
            {live.phase === 'connecting' && (
              <div style={{
                position: 'absolute', left: 10, right: 10, bottom: 10,
                display: 'flex', justifyContent: 'center', pointerEvents: 'none',
              }}>
                <span style={{
                  background: 'rgba(30,23,18,.62)', color: T.onDark,
                  padding: '7px 14px', borderRadius: radius.pill,
                  fontFamily: sans, fontSize: 12,
                }}>
                  {live.statusNote || ASK.connecting}
                </span>
              </div>
            )}
            {live.phase === 'error' && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, textAlign: 'center',
                background: 'rgba(30,23,18,.62)', color: T.onDark,
              }}>
                <Body size={14} color={T.onDark} style={{ maxWidth: 260 }}>{live.error}</Body>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Btn size="sm" onClick={() => live.retry()}>{ASK.retry}</Btn>
                  <Btn tone="onDark" size="sm" onClick={() => void handleEnd()}>{ASK.backPhoto}</Btn>
                </div>
              </div>
            )}
            {live.phase === 'live' && live.caption && (
              <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, pointerEvents: 'none' }}>
                <div style={{
                  background: 'rgba(30,23,18,.72)', color: T.onDark,
                  padding: '8px 12px', borderRadius: radius.sm,
                  fontFamily: serif, fontSize: 14, lineHeight: 1.4, textAlign: 'center',
                  maxHeight: '3.6em', overflow: 'hidden',
                }}>
                  {live.caption}
                </div>
              </div>
            )}
            {live.phase === 'live' && (
              <div style={{
                position: 'absolute', top: 10, left: 10,
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(30,23,18,.5)', padding: '5px 10px', borderRadius: radius.pill,
              }}>
                <span className="archive-live-dot" style={{
                  width: 7, height: 7, borderRadius: '50%', background: T.sienna,
                }} />
                <Eyebrow color={T.onDark}>{ASK.live}</Eyebrow>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 12, padding: '0 4px 2px' }}>
        {liveActive ? (
          <Btn tone="quiet" style={{ width: '100%', justifyContent: 'center' }} onClick={() => void handleEnd()}>
            {ASK.endCall}
          </Btn>
        ) : isOwner && !liveReady && onCreateAvatar ? (
          <Btn tone="secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onCreateAvatar}>
            {ASK.setup}
          </Btn>
        ) : liveReady && canChat ? (
          <Btn style={{ width: '100%', justifyContent: 'center' }} onClick={onStartLive}>
            {ASK.talk}
          </Btn>
        ) : canChat && onAskInWriting ? (
          <Btn tone="quiet" style={{ width: '100%', justifyContent: 'center' }} onClick={onAskInWriting}>
            {ASK.write}
          </Btn>
        ) : null}
      </div>
    </div>
  )
}
