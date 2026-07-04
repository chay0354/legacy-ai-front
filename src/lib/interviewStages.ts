export type InterviewStage = 'foundation' | 'enriched' | 'legacy'

export interface StageProgress {
  id: InterviewStage
  label: string
  done?: boolean
  current?: boolean
}

export function stagesForLevel(level: number): StageProgress[] {
  return [
    { id: 'foundation', label: 'Foundation', done: level >= 1, current: level === 0 },
    { id: 'enriched', label: 'Enriched', done: level >= 2, current: level === 1 },
    { id: 'legacy', label: 'Legacy', done: level >= 3, current: level === 2 },
  ]
}

export function stageDisplayName(stage: InterviewStage): string {
  return { foundation: 'Foundation', enriched: 'Enriched', legacy: 'Legacy' }[stage]
}

export function continueInterviewAction(level: number): {
  title: string
  note: string
  stage: InterviewStage | null
} {
  if (level >= 3) {
    return { title: 'All stages complete', note: 'Foundation, Enriched, and Legacy preserved', stage: null }
  }
  if (level >= 2) {
    return { title: 'Continue Legacy interview', note: 'Worldview, personality & meaning', stage: 'legacy' }
  }
  if (level >= 1) {
    return { title: 'Continue Enriched interview', note: 'Stories, relationships & wisdom', stage: 'enriched' }
  }
  return { title: 'Continue Foundation interview', note: 'Breadth — the first usable avatar', stage: 'foundation' }
}

export function stageGoal(stage: InterviewStage): string {
  return {
    foundation: 'Breadth — the first usable avatar',
    enriched: 'Depth — stories, relationships & wisdom',
    legacy: 'Meaning — worldview, personality & legacy',
  }[stage]
}
