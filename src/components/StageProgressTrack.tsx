import { Fragment, useEffect } from 'react'

export interface StageStep {
  label: string
  done?: boolean
  current?: boolean
}

type StageStatus = 'done' | 'current' | 'upcoming'

const C = {
  sage: '#71805c',
  terra: '#c06a44',
  ink: '#2b241c',
  ink3: '#9a8d79',
  line: '#ddccb0',
  paper: '#fbf6ec',
}

function statusOf(st: StageStep): StageStatus {
  if (st.done) return 'done'
  if (st.current) return 'current'
  return 'upcoming'
}

interface StageProgressTrackProps {
  stages: StageStep[]
  /** RoleHome hero sits on dark ink — use light label colors */
  variant?: 'light' | 'dark'
  maxWidth?: number | string
  margin?: string
}

export default function StageProgressTrack({
  stages,
  variant = 'light',
  maxWidth = 520,
  margin = '30px 0',
}: StageProgressTrackProps) {
  useEffect(() => { injectStageProgressStyles() }, [])
  const onDark = variant === 'dark'

  return (
    <div style={{ display: 'flex', alignItems: 'center', margin, maxWidth, width: '100%' }}>
      {stages.map((st, i) => {
        const status = statusOf(st)
        const isLast = i === stages.length - 1
        const nextStatus = !isLast ? statusOf(stages[i + 1]) : null
        const connectorDone = status === 'done' && (nextStatus === 'done' || nextStatus === 'current')

        return (
          <Fragment key={st.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <StageDot status={status} />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: status === 'current' ? 700 : status === 'done' ? 600 : 400,
                  color:
                    status === 'done'
                      ? onDark ? '#a8c49a' : C.sage
                      : status === 'current'
                        ? onDark ? '#fbf6ec' : C.ink
                        : onDark ? 'rgba(245,241,234,.45)' : C.ink3,
                }}
              >
                {st.label}
                {status === 'current' && (
                  <span style={{ display: 'block', fontSize: 9.5, fontWeight: 500, opacity: 0.85, marginTop: 1 }}>
                    In progress
                  </span>
                )}
                {status === 'done' && (
                  <span style={{ display: 'block', fontSize: 9.5, fontWeight: 500, opacity: 0.85, marginTop: 1 }}>
                    Complete
                  </span>
                )}
              </span>
            </div>
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: status === 'done' && connectorDone ? 2 : 1,
                  minWidth: 20,
                  margin: '0 14px',
                  borderRadius: 1,
                  background:
                    status === 'done'
                      ? connectorDone
                        ? C.sage
                        : `linear-gradient(90deg, ${C.sage}, ${C.terra})`
                      : onDark ? 'rgba(245,241,234,.18)' : C.line,
                  opacity: status === 'upcoming' ? 0.7 : 1,
                }}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function StageDot({ status }: { status: StageStatus }) {
  if (status === 'done') {
    return (
      <div
        title="Stage complete"
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: C.sage,
          color: C.paper,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(113,128,92,.35)',
          flexShrink: 0,
        }}
      >
        ✓
      </div>
    )
  }

  if (status === 'current') {
    return (
      <div style={{ position: 'relative', width: 24, height: 24, flexShrink: 0 }} title="Current stage">
        <span
          className="la-stage-pulse-ring"
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2px solid rgba(192,106,68,.35)',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: C.terra,
            color: C.paper,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            boxShadow: '0 0 0 4px rgba(192,106,68,.2), 0 4px 12px rgba(192,106,68,.35)',
          }}
        >
          ●
        </div>
      </div>
    )
  }

  return (
    <div
      title="Not started yet"
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: 'transparent',
        border: `2px dashed ${C.line}`,
        flexShrink: 0,
        opacity: 0.85,
      }}
    />
  )
}

let styleInjected = false
export function injectStageProgressStyles() {
  if (styleInjected || typeof document === 'undefined') return
  styleInjected = true
  const style = document.createElement('style')
  style.id = 'legacy-stage-progress'
  style.textContent = `@keyframes la-stage-pulse { 0%,100%{opacity:.45;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} } .la-stage-pulse-ring{animation:la-stage-pulse 2s ease-in-out infinite}`
  document.head.appendChild(style)
}
