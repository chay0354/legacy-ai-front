/** Client-side pacing so Realtime cannot skim past thin answers. */
export const MAX_USER_TURNS_PER_TOPIC = 5;

export function isSkipIntent(text: string): boolean {
  return /\b(skip|pass|next question|next topic|move on|don't know|dont know|not sure|nothing to add|that's all|thats all|no more|skip this|skip it|skip the question|let's skip|lets skip|i('d| would) rather skip)\b/i.test(
    text || '',
  );
}

export function countWords(text: string): number {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Mirror of conductor guardAdvance for the Realtime tool-call path.
 * Accept when they skip, or when there is enough substance (turns and/or words).
 */
export function shouldAcceptTopicAdvance({
  summary,
  userTurns,
  userUtterance = '',
  stage = 'foundation',
}: {
  summary: string;
  userTurns: number;
  userUtterance?: string;
  stage?: string;
}): { ok: true } | { ok: false; message: string } {
  const trimmed = String(summary || '').trim();
  const spoken = String(userUtterance || '').trim();
  if (isSkipIntent(trimmed) || isSkipIntent(spoken)) return { ok: true };

  // Hard cap: no more than 5 questions on the same topic (opening + follow-ups).
  if (userTurns >= MAX_USER_TURNS_PER_TOPIC) {
    return { ok: true };
  }

  const words = countWords(trimmed);
  const minTurns = stage === 'foundation' ? 2 : 1;
  const minWords = stage === 'legacy' ? 28 : stage === 'enriched' ? 35 : 32;
  const atQuestionLimit = userTurns >= MAX_USER_TURNS_PER_TOPIC - 1;

  if (userTurns === 0) {
    return {
      ok: false,
      message:
        'They have not really answered yet. Stay on this topic: ask the question warmly again or a gentle follow-up. Do NOT move on.',
    };
  }

  if (userTurns < minTurns && words < minWords) {
    return {
      ok: false,
      message: atQuestionLimit
        ? 'This must be your last follow-up on this topic. Ask ONE short specific question, then complete the topic after they answer — do NOT ask a 6th question.'
        : 'Not enough depth yet. Acknowledge what they said, then ask ONE specific follow-up (a name, place, feeling, or short scene). Do NOT complete this topic yet.',
    };
  }

  if (words < 14) {
    return {
      ok: false,
      message: atQuestionLimit
        ? 'You are at the question limit for this topic. Complete it now with what they shared — do NOT ask another follow-up.'
        : 'The summary is too thin. Dig once more for a concrete detail, then continue. Do NOT move to the next topic.',
    };
  }

  return { ok: true };
}
