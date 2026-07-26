/** Detect when on-screen text drifted away from the locked session language. */

export function normalizeLangCode(code?: string): string {
  const base = String(code || 'en').trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2}$/.test(base) ? base : 'en';
}

/** Hebrew / Arabic (+ presentation forms) / Cyrillic — common EN ASR/LLM drift scripts. */
const FOREIGN_SCRIPT_FOR_EN =
  /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0400-\u04FF]/;

/** High-signal German function words (avoid single-word false positives like "ja"). */
const GERMAN_WORD_RE =
  /\b(und|oder|nicht|auch|aber|wenn|weil|dann|noch|schon|sehr|hier|dort|heute|morgen|bitte|danke|guten|tag|abend|morgen|herr|frau|mein|meine|dein|deine|ihre|ihr|über|schön|können|möchte|etwas|nichts|jetzt|haben|wird|werden|sind|ist|das|der|die|den|dem|ein|eine|einen|einem|ich|sie|wir|ihr|euch|mich|dich|sich|mit|auf|für|von|zu|zum|zur|bei|nach|vor|aus|ein|kein|keine|voll|richtig|falsch|warum|wieso|welche|welcher|dieses|diese|dieser|zwischen|während|vielleicht|natürlich|eigentlich|wirklich|genau|entschuldigung|wie\s+geht'?s)\b/gi;

export function foreignScriptRatio(text: string): number {
  const letters = String(text || '').match(/\p{L}/gu) || [];
  if (!letters.length) return 0;
  const foreign = letters.filter((ch) => FOREIGN_SCRIPT_FOR_EN.test(ch)).length;
  return foreign / letters.length;
}

export function germanSignalScore(text: string): number {
  const t = String(text || '');
  if (!t.trim()) return 0;
  const umlauts = (t.match(/[äöüßÄÖÜ]/g) || []).length;
  const words = t.match(/[A-Za-zÄÖÜäöüß']+/g) || [];
  if (!words.length && !umlauts) return 0;
  const germanHits = (t.match(GERMAN_WORD_RE) || []).length;
  // Weighted: umlauts are strong; need several German words otherwise.
  return umlauts * 2 + germanHits;
}

/** True when text looks like German leaking into an English session. */
export function looksLikeGerman(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  const umlauts = (t.match(/[äöüßÄÖÜ]/g) || []).length;
  const words = t.match(/[A-Za-zÄÖÜäöüß']+/g) || [];
  if (!words.length) return umlauts >= 2;
  const germanHits = (t.match(GERMAN_WORD_RE) || []).length;
  if (umlauts >= 2) return true;
  if (umlauts >= 1 && germanHits >= 2) return true;
  if (germanHits >= 4 && germanHits / words.length >= 0.28) return true;
  if (germanHits >= 3 && words.length <= 8 && germanHits / words.length >= 0.4) return true;
  return false;
}

/** True when caption/transcript is acceptable for the locked session language. */
export function textMatchesSessionLanguage(text: string, languageCode = 'en'): boolean {
  const lang = normalizeLangCode(languageCode);
  if (lang !== 'en') return true;
  if (foreignScriptRatio(text) >= 0.35) return false;
  // German shares Latin letters — catch it with lexical/umlaut signals.
  if (looksLikeGerman(text)) return false;
  return true;
}

/** Strip or redact foreign-script / German-drift runs from English-session text. */
export function sanitizeForSessionLanguage(text: string, languageCode = 'en'): string {
  const lang = normalizeLangCode(languageCode);
  const raw = String(text || '');
  if (lang !== 'en' || !raw) return raw;
  if (textMatchesSessionLanguage(raw, lang)) return raw;

  // Drop non-Latin drift scripts first.
  let cleaned = raw
    .replace(
      /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0400-\u04FF]+/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  // If still looks German, omit rather than show a mixed-language line.
  if (looksLikeGerman(cleaned)) {
    return '[non-English speech omitted]';
  }

  return cleaned || '[non-English speech omitted]';
}
