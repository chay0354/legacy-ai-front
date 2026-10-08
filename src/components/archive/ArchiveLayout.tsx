import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ArchiveShell, { type ArchiveRouteKey } from './ArchiveShell'
import { ArchiveProvider, useArchiveLoader } from './data'
import { archiveQuery, editingSite } from '../../lib/siteEdit'
import { Loading } from './parts'
import type { SectionKey } from './sections'

export type ArchiveOutlet = { viewerName: string; viewerEmail?: string | null }

type Scroller = (key: SectionKey) => void

interface SectionNav {
  /** The main screen reports which band is being read. */
  setActive: (key: SectionKey) => void
  /** The main screen lends the shell its scroll function while mounted. */
  attach: (fn: Scroller | null) => void
}

const SectionNavContext = createContext<SectionNav | null>(null)

export function useSectionNav(): SectionNav {
  const ctx = useContext(SectionNavContext)
  if (!ctx) throw new Error('useSectionNav must be used inside the archive layout')
  return ctx
}

function routeFromPath(pathname: string): ArchiveRouteKey | undefined {
  if (pathname.startsWith('/voice-and-photo')) return 'voicePhoto'
  if (pathname.startsWith('/edit')) return 'edit'
  if (pathname.startsWith('/family-access')) return 'access'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/billing')) return 'billing'
  if (pathname.startsWith('/ask')) return 'ask'
  if (pathname.startsWith('/interview')) return 'interview'
  return undefined
}

/**
 * Keeps the sidebar and the archive data mounted; only the paper pane swaps.
 * Band navigation scrolls the main screen when it is on screen, and routes
 * back to it with a hash when it is not.
 */
export default function ArchiveWorkspace({
  creatorIdParam, viewerName, viewerEmail,
}: {
  creatorIdParam?: string
  viewerName: string
  viewerEmail?: string | null
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const ctx = useArchiveLoader(creatorIdParam)
  const [activeSection, setActiveSection] = useState<SectionKey>('setup')
  const scroller = useRef<Scroller | null>(null)

  const sample = editingSite()
  const shownName = sample ? 'Alex' : viewerName
  const shownEmail = sample ? null : viewerEmail
  const creatorId = sample ? undefined : (ctx.creatorId || creatorIdParam)
  const cQuery = archiveQuery(creatorId)
  const activeRoute = routeFromPath(location.pathname)

  const attach = useCallback((fn: Scroller | null) => { scroller.current = fn }, [])
  const nav = useMemo<SectionNav>(() => ({ setActive: setActiveSection, attach }), [attach])

  useEffect(() => {
    if (ctx.profile?.locked && !location.pathname.startsWith('/interview') && !location.pathname.startsWith('/billing')) {
      navigate('/unlock', { replace: true })
    }
  }, [ctx.profile?.locked, location.pathname, navigate])

  useEffect(() => {
    if (location.hash) return
    window.scrollTo(0, 0)
    document.querySelector('.archive-paper')?.parentElement?.scrollTo?.(0, 0)
  }, [location.pathname])

  const goSection = useCallback((key: SectionKey) => {
    if (scroller.current) scroller.current(key)
    else navigate(`/overview${cQuery}#${key}`)
  }, [navigate, cQuery])

  return (
    <ArchiveProvider value={ctx}>
      <SectionNavContext.Provider value={nav}>
        <ArchiveShell
          role={ctx.role}
          creatorId={creatorId}
          creatorName={ctx.creatorName}
          portraitUrl={ctx.portraitUrl}
          memberships={ctx.memberships}
          activeSection={activeSection}
          activeRoute={activeRoute}
          onSection={ctx.locked ? () => navigate('/unlock') : goSection}
          locked={ctx.locked}
          band
        >
          <div key={activeRoute || 'main'} className="archive-pane">
            {location.pathname.startsWith('/billing')
              ? <Outlet context={{ viewerName: shownName, viewerEmail: shownEmail } satisfies ArchiveOutlet} />
              : ctx.loading && !ctx.profile
                ? <Loading label="Opening your archive…" />
                : ctx.error && !ctx.profile
                  ? <Loading label={ctx.error} />
                  : <Outlet context={{ viewerName: shownName, viewerEmail: shownEmail } satisfies ArchiveOutlet} />}
          </div>
        </ArchiveShell>
      </SectionNavContext.Provider>
    </ArchiveProvider>
  )
}
