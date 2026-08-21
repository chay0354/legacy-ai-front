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
    { id: 'enriched', label: 'Enrichment', done: level >= 2, current: level === 1 },
    { id: 'legacy', label: 'Family Archive', done: level >= 3, current: level === 2 },
  ]
}

export function stageDisplayName(stage: InterviewStage): string {
  return { foundation: 'Foundation', enriched: 'Enrichment', legacy: 'Family Archive' }[stage]
}

export function continueInterviewAction(level: number): {
  title: string
  note: string
  stage: InterviewStage | null
} {
  if (level >= 3) {
    return { title: 'Review the archive', note: 'Review, organize, and prepare family access', stage: null }
  }
  if (level >= 2) {
    return { title: 'Continue interview', note: 'Review, organize, and prepare family access', stage: 'legacy' }
  }
  if (level >= 1) {
    return { title: 'Continue interview', note: 'Add voice, photographs, memories, and meaning', stage: 'enriched' }
  }
  return { title: 'Begin interview', note: 'Gather the core stories, people, and context', stage: 'foundation' }
}

export function stageGoal(stage: InterviewStage): string {
  return {
    foundation: 'Gather the core stories, people, and context.',
    enriched: 'Add voice, photographs, memories, and meaning.',
    legacy: 'Review, organize, and prepare family access.',
  }[stage]
}
