/** Client-side pacing so Realtime cannot skim past thin answers. */
export const MAX_USER_TURNS_PER_TOPIC = 5;

/**
 * Pause / end the whole interview (not just this topic).
 * Avoid bare "stop" — that usually means stop asking on this topic.
 */
export function isPauseInterviewIntent(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  return (
    /\b(pause( the interview)?|can we pause|let'?s pause|take a break)\b/i.test(t) ||
    /\b(stop the interview|end the interview|end (this )?session|quit the interview)\b/i.test(t) ||
    /\b(i(?:'m| am) done for (now|today)|we(?:'re| are) done for (now|today)|i(?:'m| am) done with (the|this) interview)\b/i.test(
      t,
    ) ||
    /\b(please stop the interview|can we stop( now| the interview| for now)|let'?s stop( now| the interview| for now))\b/i.test(
      t,
    )
  );
}

/** Done with this topic / refuse to answer it — advance without more follow-ups. */
export function isTopicDoneIntent(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isPauseInterviewIntent(t)) return false;
  return (
    /\b(skip|pass|next question|next topic|move on|skip this|skip it|skip the question|let'?s skip|lets skip|i(?:'d| would) rather skip)\b/i.test(
      t,
    ) ||
    /\b(don'?t know|dont know|not sure|nothing to add|that'?s all|thats all)\b/i.test(t) ||
    /\b(that'?s enough|thats enough|enough for now|stop asking|stop (with )?the questions|no more (follow[- ]?ups|questions))\b/i.test(
      t,
    ) ||
    /^(no more|enough)\.?$/i.test(t) ||
    /\b(i (?:don'?t|do not) want to (answer|talk about (this|it))|prefer not to answer|i(?:'d| would) rather not answer)\b/i.test(
      t,
    ) ||
    /\b(can we (move on|skip|stop)|let'?s (move on|skip|stop)|leave it|leave this)\b/i.test(t) ||
    /^(stop|please stop|stop please)\.?$/i.test(t)
  );
}

/**
 * Soft "no" / decline of a follow-up — stop digging, but do not treat as interview pause.
 * Bare "no" as a factual answer is allowed through depth checks; the prompt decides whether to wrap up.
 */
export function isSoftDeclineIntent(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isPauseInterviewIntent(t) || isTopicDoneIntent(t)) return false;
  return /^(no|nope|nah|no thanks|no thank you|not really|not especially|i don'?t think so|i(?:'d| would) rather not)\.?$/i.test(
    t,
  );
}

/** @deprecated Use isTopicDoneIntent — kept as alias for existing call sites. */
export function isSkipIntent(text: string): boolean {
  return isTopicDoneIntent(text);
}

/** True when the model must stop follow-ups and complete/advance this topic. */
export function isStopFollowUpIntent(text: string): boolean {
  return isTopicDoneIntent(text) || isSoftDeclineIntent(text);
}

function cleanExclusionTopic(raw: string): string {
  let s = String(raw || '').trim();
  s = s.replace(/^["'“”]+|["'“”]+$/g, '');
  s = s.replace(/^(?:the|my|our|that|this)\s+/i, '');
  s = s.replace(/\s+(?:please|ok|okay|thanks|anymore|again|with you|right now|today)$/i, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 80) return '';
  if (
    /^(this|it|that|the question|this topic|this one|anything|everything|topic|question|subject|that one|stuff)$/i.test(
      s,
    )
  ) {
    return '';
  }
  return s;
}

/** Pull "don't talk about X" style exclusions from a user utterance. */
export function extractTopicExclusions(text: string): string[] {
  const t = String(text || '').trim();
  if (!t) return [];
  const found: string[] = [];
  const patterns: RegExp[] = [
    /\b(?:don'?t|do not|never|please don'?t)\s+(?:talk|ask|speak|bring up|mention|go into|discuss|cover)\s+(?:about\s+|on\s+)?(.+?)(?:[.!?,;]|$)/gi,
    /\b(?:prefer not to|would rather not|i(?:'d| would) rather not)\s+(?:talk|discuss|go into|speak)\s+(?:about\s+)?(.+?)(?:[.!?,;]|$)/gi,
    /\b(?:leave)\s+(.+?)\s+alone\b/gi,
    /\b(?:off limits?|out of bounds)\s*:?\s*(.+?)(?:[.!?,;]|$)/gi,
    /\b(?:let'?s not|please avoid)\s+(?:talk(?:ing)?\s+)?(?:about\s+)?(.+?)(?:[.!?,;]|$)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const topic = cleanExclusionTopic(m[1] || '');
      if (topic) found.push(topic);
    }
  }
  const seen = new Set<string>();
  return found.filter((x) => {
    const key = x.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** True when an exclusion meaningfully overlaps the current topic prompt. */
export function exclusionAppliesToTopic(exclusion: string, topicPrompt: string): boolean {
  const ex = cleanExclusionTopic(exclusion).toLowerCase();
  const topic = String(topicPrompt || '').toLowerCase();
  if (!ex || !topic) return false;
  if (topic.includes(ex)) return true;
  const stop = new Set(['the', 'a', 'an', 'my', 'our', 'about', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with']);
  const tokens = ex.split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
  if (!tokens.length) return false;
  const hits = tokens.filter((tok) => topic.includes(tok)).length;
  if (tokens.length === 1) return hits === 1;
  return hits >= Math.ceil(tokens.length * 0.6);
}

export function mergeTopicExclusions(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...(existing || []), ...(incoming || [])]) {
    const n = cleanExclusionTopic(item);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
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
  if (
    isTopicDoneIntent(trimmed) ||
    isTopicDoneIntent(spoken) ||
    isSoftDeclineIntent(trimmed) ||
    isSoftDeclineIntent(spoken)
  ) {
    return { ok: true };
  }

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
        : 'Not enough depth yet. Echo a specific detail they said, then ask ONE narrow follow-up (a name, place, time, or short scene). Never use clichés like "tell me more", "how did that feel?", or "thank you for sharing." Do NOT complete this topic yet. If they say no / stop / enough, complete instead of digging.',
    };
  }

  if (words < 14) {
    return {
      ok: false,
      message: atQuestionLimit
        ? 'You are at the question limit for this topic. Complete it now with what they shared — do NOT ask another follow-up.'
        : 'The summary is too thin. Ask ONE concrete follow-up tied to their words (who / where / what happened next) — not a vague or stock interview line. If they decline (no / enough / stop asking), complete this topic immediately.',
    };
  }

  return { ok: true };
}
