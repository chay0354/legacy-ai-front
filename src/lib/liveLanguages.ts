/**
 * Languages offered for Live Call (OpenAI listens + answers, ElevenLabs speaks).
 * Keep in sync with back/src/liveLanguages.js
 */
export const LIVE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'he', label: 'Hebrew' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'fa', label: 'Persian' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'hy', label: 'Armenian' },
  { code: 'az', label: 'Azerbaijani' },
  { code: 'be', label: 'Belarusian' },
  { code: 'bs', label: 'Bosnian' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'ca', label: 'Catalan' },
  { code: 'hr', label: 'Croatian' },
  { code: 'cs', label: 'Czech' },
  { code: 'da', label: 'Danish' },
  { code: 'et', label: 'Estonian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'gl', label: 'Galician' },
  { code: 'el', label: 'Greek' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'is', label: 'Icelandic' },
  { code: 'id', label: 'Indonesian' },
  { code: 'kn', label: 'Kannada' },
  { code: 'kk', label: 'Kazakh' },
  { code: 'lv', label: 'Latvian' },
  { code: 'lt', label: 'Lithuanian' },
  { code: 'mk', label: 'Macedonian' },
  { code: 'ms', label: 'Malay' },
  { code: 'mi', label: 'Maori' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ne', label: 'Nepali' },
  { code: 'no', label: 'Norwegian' },
  { code: 'ro', label: 'Romanian' },
  { code: 'sr', label: 'Serbian' },
  { code: 'sk', label: 'Slovak' },
  { code: 'sl', label: 'Slovenian' },
  { code: 'sw', label: 'Swahili' },
  { code: 'sv', label: 'Swedish' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'ta', label: 'Tamil' },
  { code: 'th', label: 'Thai' },
  { code: 'ur', label: 'Urdu' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'cy', label: 'Welsh' },
] as const

export type LiveLanguageCode = (typeof LIVE_LANGUAGES)[number]['code']

const CODE_SET = new Set<string>(LIVE_LANGUAGES.map((l) => l.code))

export function normalizeLiveLanguage(code?: string | null): LiveLanguageCode {
  const raw = String(code || '').trim().toLowerCase()
  if (!raw) return 'en'
  const base = raw.split(/[-_]/)[0]
  if (CODE_SET.has(raw)) return raw as LiveLanguageCode
  if (CODE_SET.has(base)) return base as LiveLanguageCode
  return 'en'
}

/** Prefer the browser locale so a Hebrew speaker is not cloned as English by default. */
export function guessLiveLanguage(fallback?: string | null): LiveLanguageCode {
  if (typeof navigator === 'undefined') return normalizeLiveLanguage(fallback)
  return normalizeLiveLanguage(
    fallback
    || navigator.languages?.[0]
    || navigator.language,
  )
}
