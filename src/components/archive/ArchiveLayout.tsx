import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ArchiveShell, { type ArchiveRouteKey } from './ArchiveShell'
import { ArchiveProvider, useArchiveLoader } from './data'
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
  if (pathname.startsWith('/edit') || pathname.startsWith('/voice-and-photo')) return 'edit'
  if (pathname.startsWith('/family-access')) return 'access'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/ask')) return 'ask'
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

  const creatorId = ctx.creatorId || creatorIdParam
  const cQuery = creatorId ? `?c=${creatorId}` : ''
  const activeRoute = routeFromPath(location.pathname)

  const attach = useCallback((fn: Scroller | null) => { scroller.current = fn }, [])
  const nav = useMemo<SectionNav>(() => ({ setActive: setActiveSection, attach }), [attach])

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
          activeSection={activeSection}
          activeRoute={activeRoute}
          onSection={goSection}
        >
          <div key={activeRoute || 'main'} className="archive-pane">
            {ctx.loading && !ctx.profile
              ? <Loading label="Opening your archive…" />
              : ctx.error && !ctx.profile
                ? <Loading label={ctx.error} />
                : <Outlet context={{ viewerName, viewerEmail } satisfies ArchiveOutlet} />}
          </div>
        </ArchiveShell>
      </SectionNavContext.Provider>
    </ArchiveProvider>
  )
}
