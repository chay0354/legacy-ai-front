import { useEffect, useRef, useState } from "react";
import StageProgressTrack from "./StageProgressTrack";
import { unlockAudioPlayback, createOpenAiRealtimeInterview, fetchRealtimeInstructions, type RealtimeVoiceInterview } from "../lib/openaiRealtimeInterview";
import {
  exclusionAppliesToTopic,
  extractTopicExclusions,
  isPauseInterviewIntent,
  isSkipIntent,
  isSoftDeclineIntent,
  isTopicDoneIntent,
  mergeTopicExclusions,
  shouldAcceptTopicAdvance,
} from "../lib/interviewDepth";
import { sanitizeForSessionLanguage, textMatchesSessionLanguage } from "../lib/languageScript";
import { avatarApi, type CreatorGender, type CreatorPronouns } from "../lib/api";
import { C, serif, sans } from "../design/tokens";

/**
 * Legacy AI — Interview Session
 * A hands-free, one-question-at-a-time interview. Press Start once and it walks
 * the speaker through every question: asks → listens → confirms → auto-advances.
 * Writing mode is manual (type + Next).
 */

export interface Question {
  q: string;
  a?: string;
  /** Concrete details the interviewer should dig for on this topic. */
  digFor?: string;
}

export interface Answer {
  question: string;
  answer: string;
  mode: "voice" | "text";
}

export type TtsFn = (text: string) => Promise<void>;
export type SttHandlers = {
  onPartial: (t: string) => void;
  onFinal: (t: string) => void;
  onError?: (error: string) => void;
  /** Live call: keep listening until the user taps Stop (no auto timeout). */
  manualStop?: boolean;
  silenceMs?: number;
};

export type SttFn = (handlers: SttHandlers) => (() => void) | void;

export type PriorTopic = {
  question: string;
  summary: string;
};

export type ConductorContext = {
  subjectName: string;
  stage: string;
  anchorQuestion: string;
  /** What concrete detail to pursue on this topic. */
  digFor?: string;
  questionIndex: number;
  totalQuestions: number;
  /** Answers already captured — used so the interviewer can bridge topics. */
  priorTopics?: PriorTopic[];
  /** Subjects they asked not to discuss — kept off-limits across topics. */
  topicExclusions?: string[];
  /** Locked session language (ISO-639-1). Default English — prevents transcript drift. */
  language?: string;
  /** Explicit profile gender — never inferred from name. */
  gender?: CreatorGender | string | null;
  /** Explicit pronouns e.g. she/her — never inferred from name. */
  pronouns?: CreatorPronouns | string | null;
  /** Stories from earlier stages — so interview 2+ is not a cold start. */
  priorStories?: PriorTopic[];
  /** guided = topic list; light = one follow-up; free = they lead. */
  guidanceMode?: 'guided' | 'light' | 'free';
};

export interface AiVoiceInterview {
  connect: (ctx: ConductorContext) => Promise<void>;
  disconnect: () => void;
  pause?: () => void;
  resume?: (briefing?: {
    topicNum: number;
    totalTopics: number;
    topicPrompt: string;
    lastUserNote?: string;
  }) => void;
  nudge?: (reason?: 'idle' | 'manual' | 'escalate') => void;
  updateInstructions: (instructions: string) => void;
  completeFunctionCall: (callId: string, output: unknown, options?: { instructions?: string; continueResponse?: boolean; nextQuestionIndex?: number }) => void;
  transitionToTopic: (instructions: string, questionIndex: number) => void;
  waitForPlaybackIdle?: (timeoutMs?: number) => Promise<void>;
}

export interface InterviewSessionProps {
  subjectName?: string;
  sessionLabel?: string;
  stageLabel?: string;
  stageGoal?: string;
  stages?: { label: string; done?: boolean; current?: boolean }[];
  questions?: Question[];
  initialQuestionIndex?: number;
  /** Previously saved answers — seeds continuity when resuming mid-interview. */
  initialAnswers?: { questionIndex: number; question: string; answer: string; mode?: "voice" | "text" }[];
  /** Prior "don't talk about X" exclusions (from earlier stages / profile). */
  initialTopicExclusions?: string[];
  autoStart?: boolean;
  accent?: string;
  ambient?: boolean;
  tts?: TtsFn | null;
  stt?: SttFn | null;
  /** When true, voice mode uses OpenAI Realtime API (WebRTC speech-to-speech). */
  aiVoice?: boolean;
  interviewStage?: string;
  /** Locked speaking/transcript language (ISO-639-1). Defaults to English. */
  interviewLanguage?: string;
  onAnswerCommit?: (answer: Answer & { questionIndex: number; skipped: boolean }) =>
    void | Promise<void | { questions?: Question[] }>;
  onComplete?: (answers: Answer[], meta?: { topicExclusions?: string[] }) => void | Promise<void>;
  onViewAvatar?: () => void;
  onViewLegacy?: () => void;
  onManageAccess?: () => void;
  /** Preserve: interview is done, but the archive stays closed until they pay. */
  archiveLocked?: boolean;
  onBack?: () => void;
  /** Rendered inside the archive paper pane — no full-page chrome. */
  embedded?: boolean;
  /** Answers from earlier stages — cited when this stage opens. */
  priorStories?: PriorTopic[];
  processing?: boolean;
  processingError?: string | null;
  onRetryPreservation?: () => void;
  extractionResult?: {
    session_summary?: string;
    completion_score?: number;
    stage?: string;
    counts?: { memories: number; relationships: number; values: number; wisdom: number; threads: number };
  } | null;
}

const mono = sans;

const DEFAULT_QS: Question[] = [
  { q: "Tell me about the family you grew up in.",
    a: "We didn't have much. My father, Tomas, ran a little repair shop in Braddock, and he could fix anything you put in front of him. My mother held us together on not much more than her will. They taught me that your word is the whole of your credit." },
  { q: "What's an early memory that still makes you smile?",
    a: "Sunday mornings. My mother's kitchen radio, the smell of her bread, and my father actually smiling for a few hours. For that little while, nobody worried about money." },
  { q: "What would you want the people who come after you to know?",
    a: "Do the work when no one is watching. Keep your word, even when it costs you. And call your brother — don't wait twenty years the way I did." },
];

const REVEAL_MS = 110;
const ASK_MS    = 1400;
const DONE_MS   = 2300;

type Phase = "asking" | "listening" | "done";
type Mode  = "voice" | "text";

function useInjectedHead() {
  useEffect(() => {
    const id = "legacy-ai-interview-head";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes la-ring { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.85);opacity:0} }
      @keyframes la-eq { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
      @keyframes la-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
      @keyframes la-rec { 0%,100%{opacity:1} 50%{opacity:.3} }
      @keyframes la-breathe { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.25);opacity:.55} }
      .legacy-interview ::selection { background:#b05e37; color:#f0e7d6 }
    `;
    document.head.appendChild(style);
  }, []);
}

export default function InterviewSession({
  subjectName = "Arthur",
  sessionLabel = "Session One",
  stageLabel = "Foundation",
  stageGoal = "Breadth — the first usable avatar",
  stages = [
    { label: "Foundation", current: true },
    { label: "Enriched" },
    { label: "Legacy" },
  ],
  questions = DEFAULT_QS,
  initialQuestionIndex = 0,
  initialAnswers = [],
  initialTopicExclusions = [],
  autoStart = false,
  accent = C.terra,
  ambient = true,
  tts = null,
  stt = null,
  aiVoice = false,
  interviewStage = "foundation",
  interviewLanguage = "en",
  onAnswerCommit,
  onComplete = (a) => console.log("interview complete", a),
  onViewAvatar,
  onViewLegacy,
  archiveLocked = false,
  onManageAccess = () => {},
  onBack,
  embedded = false,
  priorStories = [],
  processing = false,
  processingError = null,
  onRetryPreservation,
  extractionResult = null,
}: InterviewSessionProps) {
  useInjectedHead();

  const [liveQuestions, setLiveQuestions] = useState(questions);
  useEffect(() => { setLiveQuestions(questions); }, [questions]);
  const QS    = liveQuestions;
  const TOTAL = QS.length;

  const [started,    setStarted]    = useState(false);
  const [complete,   setComplete]   = useState(false);
  const [mode,       setMode]       = useState<Mode>("voice");
  const [q,          setQ]          = useState(initialQuestionIndex);
  const [phase,      setPhase]      = useState<Phase>("asking");
  const [transcript, setTranscript] = useState("");
  const [typed,      setTyped]      = useState("");
  const [paused,     setPaused]     = useState(false);
  const [secs,       setSecs]       = useState(0);
  const [convLive,   setConvLive]   = useState(false);
  /** Spoken turns for the current topic — must match what was actually said. */
  const [chatTurns,  setChatTurns]  = useState<{ id: string; role: "user" | "assistant"; text: string }[]>([]);
  const [partialAssistant, setPartialAssistant] = useState("");
  const [partialUser, setPartialUser] = useState("");
  const [aiError,    setAiError]    = useState<string | null>(null);
  const [gender, setGender] = useState<CreatorGender>(null);
  const [pronouns, setPronouns] = useState<CreatorPronouns>(null);
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [guidanceMode, setGuidanceMode] = useState<'guided' | 'light' | 'free'>('guided');
  const [changingIdentity, setChangingIdentity] = useState(false);
  const guidanceModeRef = useRef<'guided' | 'light' | 'free'>('guided');
  const genderRef = useRef<CreatorGender>(null);
  const pronounsRef = useRef<CreatorPronouns>(null);
  const turnSeqRef = useRef(0);
  /** Accumulated user speech for the current topic (avoids stale React state on advance). */
  const userSpokenRef = useRef('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const answersRef  = useRef<Answer[]>([]);
  const sttStopRef  = useRef<(() => void) | null>(null);
  const simIdxRef   = useRef(0);
  const realtimeRef = useRef<RealtimeVoiceInterview | null>(null);
  const activeQuestionRef = useRef(initialQuestionIndex);
  const userTurnsRef = useRef(0);
  const lastUserUtteranceRef = useRef('');
  const skippingRef = useRef(false);
  const finishingRef = useRef(false);
  const prevModeRef = useRef<Mode>(mode);
  const seededAnswersRef = useRef(false);
  const topicExclusionsRef = useRef<string[]>(mergeTopicExclusions([], initialTopicExclusions));
  const exclusionUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!seededAnswersRef.current && initialAnswers.length > 0) {
    seededAnswersRef.current = true;
    for (const saved of initialAnswers) {
      if (!saved?.answer?.trim()) continue;
      answersRef.current[saved.questionIndex] = {
        question: saved.question || QS[saved.questionIndex]?.q || '',
        answer: saved.answer,
        mode: saved.mode || 'voice',
      };
    }
  }

  const cur       = QS[q];
  const running   = started && !complete;
  const voiceMode = mode === "voice";
  const aiVoiceMode = voiceMode && aiVoice;

  useEffect(() => {
    activeQuestionRef.current = q;
  }, [q]);

  // Keep the conversation scroller pinned to the latest spoken line.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chatTurns, partialAssistant, partialUser]);

  const stopConversation = () => {
    realtimeRef.current?.disconnect();
    realtimeRef.current = null;
    setConvLive(false);
  };

  const clearTopicTranscript = () => {
    setChatTurns([]);
    setPartialAssistant("");
    setPartialUser("");
    setTranscript("");
    userSpokenRef.current = "";
  };

  const sessionLang = interviewLanguage || "en";

  const appendFinalTurn = (role: "user" | "assistant", text: string) => {
    const raw = text.trim();
    if (!raw) return;
    // English sessions: never paint Hebrew/Arabic dumps onto the conversation UI.
    if (!textMatchesSessionLanguage(raw, sessionLang)) return;
    const cleaned = sanitizeForSessionLanguage(raw, sessionLang);
    if (!cleaned || cleaned === "[non-English speech omitted]") return;
    turnSeqRef.current += 1;
    const id = `${role}-${turnSeqRef.current}`;
    setChatTurns((prev) => {
      // Dedupe exact consecutive repeats (done + response.done fallback).
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.text === cleaned) return prev;
      return [...prev, { id, role, text: cleaned }];
    });
    if (role === "user") {
      userSpokenRef.current = userSpokenRef.current
        ? `${userSpokenRef.current} ${cleaned}`
        : cleaned;
      setTranscript(userSpokenRef.current);
    }
  };

  /** Last topic done — let wrap-up audio finish, then preserve. */
  const endInterviewSession = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setPaused(false);
    setComplete(true);
    clearTopicTranscript();
    if (sttStopRef.current) {
      sttStopRef.current();
      sttStopRef.current = null;
    }
    try {
      await realtimeRef.current?.waitForPlaybackIdle?.(10000);
    } catch { /* disconnect anyway */ }
    stopConversation();
    try {
      await onComplete(answersRef.current.filter(Boolean), {
        topicExclusions: topicExclusionsRef.current,
      });
    } catch (err) {
      console.warn('[interview] onComplete failed', err);
    }
  };

  const pushTopicExclusions = (incoming: string[], opts?: { skipIfCurrent?: boolean }) => {
    const before = topicExclusionsRef.current.length;
    topicExclusionsRef.current = mergeTopicExclusions(topicExclusionsRef.current, incoming);
    if (topicExclusionsRef.current.length === before) return false;

    const questionIndex = activeQuestionRef.current;
    const prompt = QS[questionIndex]?.q || '';
    if (opts?.skipIfCurrent !== false) {
      const hitsCurrent = incoming.some((ex) => exclusionAppliesToTopic(ex, prompt));
      if (hitsCurrent && !skippingRef.current) {
        void skipCurrentTopic();
        return true;
      }
    }

    if (aiVoiceMode && realtimeRef.current && running && !finishingRef.current) {
      if (exclusionUpdateTimerRef.current) clearTimeout(exclusionUpdateTimerRef.current);
      exclusionUpdateTimerRef.current = setTimeout(() => {
        void fetchRealtimeInstructions(ctxFor(activeQuestionRef.current))
          .then((instructions) => {
            realtimeRef.current?.updateInstructions(instructions);
          })
          .catch((err) => console.warn('[interview] exclusion instruction update failed', err));
      }, 200);
    }
    return true;
  };

  const priorTopicsFor = (questionIndex: number): PriorTopic[] =>
    answersRef.current
      .slice(0, questionIndex)
      .filter((a): a is Answer => Boolean(a?.answer?.trim()))
      .map((a) => ({
        question: a.question,
        // Pass their words as confirmed background — interviewer must not invent beyond this.
        summary: a.answer.trim(),
      }));

  useEffect(() => {
    let cancelled = false;
    avatarApi.getAssets({ light: true })
      .then((r) => {
        if (cancelled) return;
        const g = (r.gender ?? null) as CreatorGender;
        const p = (r.pronouns ?? null) as CreatorPronouns;
        setGender(g);
        setPronouns(p);
        genderRef.current = g;
        pronounsRef.current = p;
      })
      .catch(() => { /* identity optional until they set it */ });
    return () => { cancelled = true; };
  }, []);

  const ctxFor = (questionIndex: number): ConductorContext => ({
    subjectName,
    stage: interviewStage,
    anchorQuestion: QS[questionIndex]?.q || '',
    digFor: QS[questionIndex]?.digFor || '',
    questionIndex,
    totalQuestions: TOTAL,
    priorTopics: [
      ...priorStories,
      ...priorTopicsFor(questionIndex),
    ],
    priorStories,
    topicExclusions: topicExclusionsRef.current,
    language: interviewLanguage || 'en',
    gender: genderRef.current,
    pronouns: pronounsRef.current,
    guidanceMode: guidanceModeRef.current,
  });

  const handleRealtimeAdvance = async (questionIndex: number, summary: string, callId: string) => {
    if (finishingRef.current || complete) {
      realtimeRef.current?.completeFunctionCall(
        callId,
        { ok: true, complete: true, message: 'Interview already finishing.' },
        { continueResponse: false },
      );
      return;
    }
    if (skippingRef.current) {
      realtimeRef.current?.completeFunctionCall(
        callId,
        { ok: true, message: 'Topic already skipped.' },
        { continueResponse: false },
      );
      return;
    }

    let completed = false;
    const finish = (output: unknown, options?: { instructions?: string; continueResponse?: boolean; nextQuestionIndex?: number }) => {
      if (completed) return;
      completed = true;
      realtimeRef.current?.completeFunctionCall(callId, output, options);
    };

    try {
      const answer = summary.trim();
      const lastUtterance = lastUserUtteranceRef.current;
      const skipped =
        isTopicDoneIntent(answer) ||
        isTopicDoneIntent(lastUtterance) ||
        isSoftDeclineIntent(answer) ||
        isSoftDeclineIntent(lastUtterance) ||
        isSkipIntent(answer) ||
        isSkipIntent(lastUtterance);
      const depth = shouldAcceptTopicAdvance({
        summary: answer,
        userTurns: userTurnsRef.current,
        userUtterance: lastUtterance,
        stage: interviewStage,
      });

      if (!depth.ok) {
        finish({
          ok: false,
          continue: true,
          message: depth.message,
        });
        return;
      }

      // Prefer the user's actual spoken words for storage; fall back to model summary.
      // Even on skip/stop, keep what they already said — don't wipe a real answer.
      const spokenWords = userSpokenRef.current.trim() || lastUserUtteranceRef.current.trim();
      const savedAnswer = spokenWords || (skipped ? '' : answer);
      const trulySkipped = skipped && !savedAnswer.trim();
      answersRef.current[questionIndex] = { question: QS[questionIndex].q, answer: savedAnswer, mode: "voice" };
      userTurnsRef.current = 0;
      lastUserUtteranceRef.current = '';

      let list = QS;
      if (onAnswerCommit) {
        const nextList = await onAnswerCommit({
          questionIndex,
          question: QS[questionIndex].q,
          answer: savedAnswer,
          mode: "voice",
          skipped: trulySkipped,
        });
        if (nextList?.questions?.length) {
          list = nextList.questions;
          setLiveQuestions(list);
        }
      }

      if (questionIndex < list.length - 1) {
        if (finishingRef.current) {
          finish({ ok: true, complete: true }, { continueResponse: false });
          return;
        }
        const next = questionIndex + 1;
        const total = list.length;
        setQ(next);
        clearTopicTranscript();
        const nextCtx = {
          ...ctxFor(next),
          anchorQuestion: list[next]?.q || '',
          digFor: list[next]?.digFor || '',
          totalQuestions: total,
        };
        const instructions = await fetchRealtimeInstructions(nextCtx);
        // Apply next-topic instructions before the model speaks again (avoids racing on old prompt).
        const langLock = ` Speak only in session language "${sessionLang}" — never Hebrew, Arabic, German, or any other language.`;
        finish(
          {
            ok: true,
            message: (trulySkipped
              ? `They asked to leave this topic. New instructions are loaded for topic ${next + 1} of ${total}. Acknowledge briefly (no follow-up on the skipped topic) and open the next topic warmly.`
              : skipped
                ? `They asked to stop this topic. What they said is saved. New instructions are loaded for topic ${next + 1} of ${total}. Acknowledge briefly — do NOT dig further — then open the next topic warmly.`
                : `Topic saved. New instructions are loaded for topic ${next + 1} of ${total}. Transition warmly — a soft progress cue in plain language (topic ${next + 1} of ${total}), bridge from their story if it fits, then ask the next topic in your own words. Never say "next question" or sound like a checklist. Do not re-welcome them.`) + langLock,
          },
          { instructions, nextQuestionIndex: next },
        );
      } else {
        // Critical: do NOT request another model turn — that left sessions hanging after the last topic.
        finish(
          {
            ok: true,
            complete: true,
            message: 'Interview complete. Do not speak further. The session is ending now.',
          },
          { continueResponse: false },
        );
        await endInterviewSession();
      }
    } catch (err) {
      console.warn('[interview] advance failed — keeping session alive', err);
      // Never leave a tool-call hanging: that freezes the whole interview.
      finish({
        ok: false,
        continue: true,
        message: 'A save hiccup happened. Stay on this topic, acknowledge briefly, and continue the conversation warmly.',
      });
      setAiError('Connection hiccup — continuing this topic. You can keep talking.');
    }
  };

  const skipCurrentTopic = async () => {
    if (!running || complete || skippingRef.current || finishingRef.current) return;
    skippingRef.current = true;
    try {
      const questionIndex = activeQuestionRef.current;
      // Preserve anything already spoken; only mark skipped when there is nothing to keep.
      const kept = userSpokenRef.current.trim() || lastUserUtteranceRef.current.trim();
      answersRef.current[questionIndex] = {
        question: QS[questionIndex].q,
        answer: kept,
        mode: 'voice',
      };

      let list = QS;
      if (onAnswerCommit) {
        const nextList = await onAnswerCommit({
          questionIndex,
          question: QS[questionIndex].q,
          answer: kept,
          mode: 'voice',
          skipped: !kept,
        });
        if (nextList?.questions?.length) {
          list = nextList.questions;
          setLiveQuestions(list);
        }
      }

      userTurnsRef.current = 0;
      lastUserUtteranceRef.current = '';
      clearTopicTranscript();

      if (questionIndex < list.length - 1) {
        const next = questionIndex + 1;
        setQ(next);
        if (aiVoiceMode && realtimeRef.current) {
          const nextCtx = {
            ...ctxFor(next),
            anchorQuestion: list[next]?.q || '',
            digFor: list[next]?.digFor || '',
            totalQuestions: list.length,
          };
          const instructions = await fetchRealtimeInstructions(nextCtx);
          realtimeRef.current.transitionToTopic(instructions, next);
        } else {
          stopConversation();
          void startRealtimeConversation(next);
        }
      } else {
        await endInterviewSession();
      }
    } finally {
      skippingRef.current = false;
    }
  };

  const pauseInterviewFromVoice = () => {
    if (!running || complete || paused || finishingRef.current) return;
    setPaused(true);
    realtimeRef.current?.pause();
  };

  const startRealtimeConversation = async (questionIndex: number) => {
    if (!aiVoice) return;
    stopConversation();
    setAiError(null);
    userTurnsRef.current = 0;

    const client = createOpenAiRealtimeInterview({
      onLiveLine: (text, role, meta) => {
        const partial = Boolean(meta?.partial);
        if (partial) {
          if (role === 'assistant') {
            setPartialAssistant((prev) => {
              const next = prev + text;
              return textMatchesSessionLanguage(next, sessionLang) ? next : prev;
            });
          } else {
            setPartialUser((prev) => {
              const next = prev + text;
              return textMatchesSessionLanguage(next, sessionLang) ? next : prev;
            });
          }
          return;
        }

        // Final utterance — replace the streaming draft with the authoritative text.
        if (role === 'assistant') {
          setPartialAssistant('');
          appendFinalTurn('assistant', text);
          return;
        }

        setPartialUser('');
        const cleaned = text.trim();
        if (!cleaned) return;
        // Drop ASR language-drift so we don't advance/skip on Hebrew garbage in EN sessions.
        if (!textMatchesSessionLanguage(cleaned, sessionLang)) return;
        const safe = sanitizeForSessionLanguage(cleaned, sessionLang);
        if (!safe || safe === '[non-English speech omitted]') return;
        lastUserUtteranceRef.current = safe;
        userTurnsRef.current += 1;
        appendFinalTurn('user', safe);

        const exclusions = extractTopicExclusions(safe);
        if (exclusions.length) {
          pushTopicExclusions(exclusions);
          return;
        }

        // "Please stop" / "pause" / "I'm done" → pause the interview (UI resume).
        if (isPauseInterviewIntent(safe)) {
          pauseInterviewFromVoice();
          return;
        }

        // Done with this topic / refuse / stop asking — advance; keep what they said.
        if (isTopicDoneIntent(safe) && !skippingRef.current) {
          void skipCurrentTopic();
          return;
        }

        // Soft "no" after a follow-up (2+ turns) — stop digging and move on.
        if (
          isSoftDeclineIntent(safe) &&
          userTurnsRef.current >= 2 &&
          !skippingRef.current
        ) {
          void skipCurrentTopic();
        }
      },
      onTopicExclusion: (topic) => {
        pushTopicExclusions([topic]);
      },
      onConnected: () => {
        setConvLive(true);
        setAiError(null);
      },
      onError: (msg) => {
        setAiError(msg);
        // Soft errors: keep the socket if possible; hard disconnect only on connect failures from connect().
        if (/token|SDP|microphone|permission|session failed|Could not start/i.test(msg)) {
          stopConversation();
        } else {
          realtimeRef.current?.nudge?.('manual');
        }
      },
      onAdvance: (summary, callId, questionIndex) => handleRealtimeAdvance(questionIndex, summary, callId),
    });

    realtimeRef.current = client;
    try {
      await client.connect(ctxFor(questionIndex));
    } catch (e) {
      if (realtimeRef.current === client) {
        setAiError(e instanceof Error ? e.message : "Could not start voice conversation");
        stopConversation();
      }
    }
  };

  /** Reconnect AI voice (or browser ask/listen) when switching Talking ↔ Writing. */
  useEffect(() => {
    if (!running) {
      prevModeRef.current = mode;
      return;
    }

    const prev = prevModeRef.current;
    if (mode === "text" && prev === "voice") {
      if (sttStopRef.current) {
        sttStopRef.current();
        sttStopRef.current = null;
      }
      stopConversation();
    }

    if (mode === "voice" && prev === "text") {
      clearTopicTranscript();
      setAiError(null);
      setPaused(false);
      simIdxRef.current = 0;
      if (aiVoice) {
        void startRealtimeConversation(q);
      } else {
        setPhase("asking");
      }
    }

    prevModeRef.current = mode;
  }, [mode, running, q, aiVoice]); // eslint-disable-line

  const answered  = voiceMode ? transcript.trim().length > 0 : typed.trim().length > 0;
  const asking    = running && voiceMode && !aiVoiceMode && phase === "asking"    && !paused;
  const listening = running && voiceMode && !aiVoiceMode && phase === "listening" && !paused;
  const doneV     = running && voiceMode && !aiVoiceMode && phase === "done";

  useEffect(() => () => stopConversation(), []); // eslint-disable-line

  const togglePause = () => {
    // Side effects outside setState — React may double-invoke updaters in Strict Mode.
    const next = !paused;
    setPaused(next);
    if (aiVoiceMode) {
      if (next) {
        realtimeRef.current?.pause();
      } else {
        realtimeRef.current?.resume({
          topicNum: q + 1,
          totalTopics: TOTAL,
          topicPrompt: cur?.q || '',
          lastUserNote: lastUserUtteranceRef.current || transcript.trim() || undefined,
        });
      }
    } else if (next && sttStopRef.current) {
      sttStopRef.current();
      sttStopRef.current = null;
    }
  };

  const goNextWithAnswer = async (answerOverride?: string) => {
    if (finishingRef.current || complete) return;
    const answer = answerOverride ?? (voiceMode ? transcript : typed);
    if (isPauseInterviewIntent(answer)) {
      pauseInterviewFromVoice();
      return;
    }
    const exclusions = extractTopicExclusions(answer);
    if (exclusions.length) {
      topicExclusionsRef.current = mergeTopicExclusions(topicExclusionsRef.current, exclusions);
      if (exclusions.some((ex) => exclusionAppliesToTopic(ex, cur.q))) {
        await skipCurrentTopic();
        return;
      }
    }
    if (isTopicDoneIntent(answer) || (isSoftDeclineIntent(answer) && userTurnsRef.current >= 1)) {
      userSpokenRef.current = answer.trim() || userSpokenRef.current;
      await skipCurrentTopic();
      return;
    }
    const skipped = !answer.trim();
    answersRef.current[q] = { question: cur.q, answer, mode };

    let list = QS;
    if (onAnswerCommit) {
      const nextList = await onAnswerCommit({
        questionIndex: q,
        question: cur.q,
        answer,
        mode,
        skipped,
      });
      if (nextList?.questions?.length) {
        list = nextList.questions;
        setLiveQuestions(list);
      }
    }

    if (sttStopRef.current) { sttStopRef.current(); sttStopRef.current = null; }
    stopConversation();
    if (q < list.length - 1) {
      const next = q + 1;
      setQ(next);
      clearTopicTranscript();
      setTyped("");
      simIdxRef.current = 0;
      if (aiVoiceMode) {
        void startRealtimeConversation(next);
      } else {
        setPhase("asking");
      }
    } else {
      await endInterviewSession();
    }
  };

  /* auto-resume if session has prior progress */
  useEffect(() => {
    if (autoStart && initialQuestionIndex > 0 && !started && !complete) {
      setStarted(true);
      setMode("voice");
      setQ(initialQuestionIndex);
      if (aiVoice) {
        void startRealtimeConversation(initialQuestionIndex);
      } else {
        setPhase("asking");
        simIdxRef.current = 0;
      }
    }
  }, [autoStart, initialQuestionIndex, aiVoice]); // eslint-disable-line

  /* clock */
  useEffect(() => {
    if (!running || paused) return;
    const iv = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [running, paused]);

  const goNext = async () => {
    if (aiVoiceMode) {
      await skipCurrentTopic();
      return;
    }
    stopConversation();
    await goNextWithAnswer();
  };

  /* ASKING → LISTENING */
  useEffect(() => {
    if (!asking) return;
    let cancelled = false;
    if (tts) {
      Promise.resolve(tts(cur.q)).then(() => { if (!cancelled) setPhase("listening"); });
      return () => { cancelled = true; };
    }
    const t = setTimeout(() => setPhase("listening"), ASK_MS);
    return () => clearTimeout(t);
  }, [asking, q]); // eslint-disable-line

  /* LISTENING */
  useEffect(() => {
    if (!listening) return;
    if (stt) {
      const stop = stt({
        onPartial: (text) => setTranscript(text),
        onFinal:   (text) => { setTranscript(text); setPhase("done"); },
      });
      sttStopRef.current = typeof stop === "function" ? stop : null;
      return () => { if (sttStopRef.current) { sttStopRef.current(); sttStopRef.current = null; } };
    }
    const words = (cur.a || "").split(" ");
    const iv = setInterval(() => {
      simIdxRef.current += 1;
      const n = simIdxRef.current;
      setTranscript(words.slice(0, n).join(" "));
      if (n >= words.length) { clearInterval(iv); setPhase("done"); }
    }, REVEAL_MS);
    return () => clearInterval(iv);
  }, [listening, q]); // eslint-disable-line

  /* DONE → auto-advance */
  useEffect(() => {
    if (!doneV || paused) return;
    const t = setTimeout(goNext, DONE_MS);
    return () => clearTimeout(t);
  }, [doneV, paused, q]); // eslint-disable-line

  const defaultPronounsForGender = (g: CreatorGender): CreatorPronouns => {
    if (g === "female") return "she/her";
    if (g === "male") return "he/him";
    return null;
  };

  const persistIdentity = async (nextGender: CreatorGender, nextPronouns: CreatorPronouns) => {
    setIdentityBusy(true);
    setIdentityError(null);
    try {
      const r = await avatarApi.saveIdentity({ gender: nextGender, pronouns: nextPronouns });
      const g = (r.gender ?? nextGender) as CreatorGender;
      const p = (r.pronouns ?? nextPronouns) as CreatorPronouns;
      setGender(g);
      setPronouns(p);
      genderRef.current = g;
      pronounsRef.current = p;
    } catch (e) {
      setIdentityError(e instanceof Error ? e.message : "Could not save pronouns");
      throw e;
    } finally {
      setIdentityBusy(false);
    }
  };

  const ensureIdentityBeforeStart = async (): Promise<boolean> => {
    if (!pronounsRef.current && genderRef.current) {
      const p = defaultPronounsForGender(genderRef.current);
      if (p) {
        try {
          await persistIdentity(genderRef.current, p);
        } catch {
          return false;
        }
      }
    }
    if (!pronounsRef.current) {
      setIdentityError("Please set your pronouns before starting — we never guess from your name.");
      return false;
    }
    setIdentityError(null);
    return true;
  };

  /* controls */
  const startVoice = (mode: 'guided' | 'light' | 'free' = 'guided') => {
    void (async () => {
      setGuidanceMode(mode);
      guidanceModeRef.current = mode;
      if (!(await ensureIdentityBeforeStart())) return;
      unlockAudioPlayback();
      finishingRef.current = false;
      setStarted(true); setMode("voice"); setQ(initialQuestionIndex); setSecs(0); setComplete(false);
      clearTopicTranscript();
      setAiError(null);
      simIdxRef.current = 0;
      if (aiVoice) void startRealtimeConversation(initialQuestionIndex);
      else setPhase("asking");
    })();
  };
  const startText = () => {
    void (async () => {
      if (!(await ensureIdentityBeforeStart())) return;
      finishingRef.current = false;
      stopConversation();
      setStarted(true);
      setMode("text");
      setQ(initialQuestionIndex);
      setSecs(0);
      setComplete(false);
      setPhase("asking");
      setTyped("");
    })();
  };
  const switchVoice = () => {
    setTyped("");
    setMode("voice");
  };
  const switchText = () => {
    setMode("text");
  };
  const toggleListen = () => {
    if (phase === "listening") {
      if (sttStopRef.current) { sttStopRef.current(); sttStopRef.current = null; }
      if (!stt && !transcript) setTranscript(cur.a || "");
      setPhase("done");
    } else if (phase === "asking") {
      setPhase("listening");
    }
  };

  const elapsed  = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const lastQ    = q === TOTAL - 1;

  const aiMicBg = paused ? C.ink3 : convLive ? C.terra : C.gold;

  const aiStatusLabel = paused ? "Paused" : convLive ? "In conversation" : "Connecting…";

  const micBg      = aiVoiceMode ? aiMicBg : (paused ? C.ink3 : phase === "done" ? C.sage : phase === "asking" ? C.gold : C.terra);
  const micShadow  = aiVoiceMode
    ? (convLive ? "rgba(192,106,68,.34)" : "rgba(179,144,47,.30)")
    : (phase === "done" ? "rgba(113,128,92,.32)" : phase === "asking" ? "rgba(179,144,47,.30)" : "rgba(192,106,68,.34)");
  const statusLabel = aiVoiceMode ? aiStatusLabel : (paused ? "Paused"
    : asking    ? "Here comes your question…"
    : listening ? "Listening… just speak"
    : doneV     ? "Got it — that's saved" : "Listening…");
  const statusColor  = paused ? C.ink3 : (aiVoiceMode ? (convLive ? C.terra : C.gold) : (doneV ? C.sage : asking ? C.gold : C.terra));
  const reassurance  = paused ? "Paused. Tap Resume when you're ready — the interviewer will pick up where you left off."
    : voiceMode
      ? aiVoiceMode
        ? "Just talk — I'll listen and guide us to the next question when you're ready."
        : asking    ? "Listen for the question, then answer in your own words."
        : listening ? "I'll move us along when you're done — or tap the circle to finish sooner."
        : "One moment — the next question is coming up."
      : "Write as much or as little as you like.";

  const markInitial = (subjectName.trim()[0] || "L").toUpperCase();
  const Mark = ({ size = 24, border, color, font = 13 }: { size?: number; border: string; color: string; font?: number }) => (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: font, color }}>{markInitial}</div>
  );

  const tab = (active: boolean): React.CSSProperties => ({
    cursor: "pointer", border: "none", borderRadius: 999, fontFamily: sans, fontSize: 13,
    padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 7,
    background: active ? C.card : "transparent",
    color: active ? C.ink : C.ink3,
    fontWeight: active ? 600 : 500,
    boxShadow: active ? "0 2px 6px rgba(43,36,28,.10)" : "none",
  });

  return (
    <div className={`legacy-interview${embedded ? " is-embedded" : ""}`} style={{
      minHeight: embedded ? undefined : "100vh", background: embedded ? "transparent" : C.paper,
      backgroundImage: embedded ? "none" : "radial-gradient(1000px 560px at 50% -14%, rgba(255,251,242,.72), transparent 62%)",
      fontFamily: sans, color: C.ink, display: "flex", flexDirection: "column", WebkitFontSmoothing: "antialiased",
    }}>
      {/* TOP BAR */}
      <div style={{
        flex: "none",
        borderBottom: embedded ? "none" : `1px solid ${C.line}`,
        background: embedded ? "#1e1712" : undefined,
        margin: embedded ? "0 -8px 8px" : undefined,
        padding: embedded ? "10px 16px 12px" : undefined,
        borderRadius: embedded ? 4 : undefined,
      }}>
        <div className="legacy-interview-top" style={{ maxWidth: 920, margin: "0 auto", padding: embedded ? "0 0" : "0 28px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!embedded && (
              <>
                <Mark border={C.umber} color={C.umber} />
                <div className="legacy-interview-brand" style={{ fontFamily: serif, fontSize: 19, color: C.ink }}>Legacy AI</div>
              </>
            )}
          </div>
          <div className="legacy-interview-status" style={{ fontFamily: sans, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600, color: embedded ? "rgba(240,231,214,.62)" : C.ink3, display: "flex", alignItems: "center", gap: 7 }}>
            {running ? (
              <>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.terra, animation: ambient && !paused ? "la-rec 1.4s ease-in-out infinite" : "none" }} />
                <span style={{ color: C.terra }}>Topic {q + 1}/{TOTAL}</span>
                <span style={{ color: embedded ? "rgba(240,231,214,.28)" : C.line }}>·</span>
                <span>{elapsed}</span>
              </>
            ) : <span>{stageLabel} · {sessionLabel}{guidanceMode === "free" ? " · free talk" : guidanceMode === "light" ? " · lighter" : ""}</span>}
          </div>
          <div style={{ minWidth: 78, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            {running && (
              <button onClick={togglePause} style={{ cursor: "pointer", background: "transparent", border: `1px solid ${embedded ? "rgba(240,231,214,.22)" : C.line}`, color: embedded ? "#f0e7d6" : C.ink2, fontFamily: sans, fontWeight: 500, fontSize: 13, padding: "8px 16px", borderRadius: 4 }}>{paused ? "Resume" : "Pause"}</button>
            )}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{ cursor: "pointer", background: embedded ? "rgba(240,231,214,.10)" : C.card, border: `1px solid ${embedded ? "rgba(240,231,214,.22)" : C.line}`, color: embedded ? "#f0e7d6" : C.ink2, fontFamily: sans, fontWeight: 500, fontSize: 13, padding: "8px 16px", borderRadius: 4, whiteSpace: "nowrap" }}
              >
                Back to home
              </button>
            )}
          </div>
        </div>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 28px 14px", display: "flex", justifyContent: "center" }}>
          <StageProgressTrack stages={stages} margin="0" maxWidth={520} />
        </div>
      </div>

      {/* MAIN */}
      <div className="legacy-interview-main" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: embedded ? "24px 0 32px" : "40px 28px 56px", boxSizing: "border-box" }}>

        {/* INTRO */}
        {!started && !complete && (
          <div style={{ width: "100%", maxWidth: 560, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ position: "relative", width: 56, height: 56, marginBottom: 26 }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: C.gold, animation: ambient ? "la-ring 2.6s ease-out infinite" : "none", opacity: ambient ? undefined : 0 }} />
              <div style={{ position: "relative", width: 56, height: 56, borderRadius: "50%", background: "radial-gradient(circle at 38% 34%, #d8b34d, #b3902f)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 15, height: 15, borderRadius: "50%", background: "rgba(255,251,242,.9)" }} />
              </div>
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: C.ink3, marginBottom: 14 }}>{stageLabel} · {stageGoal}</div>
            <h1 className="legacy-interview-question" style={{ fontFamily: serif, fontWeight: 400, fontSize: 42, lineHeight: 1.12, letterSpacing: "-.015em", margin: 0, color: C.ink, textWrap: "pretty" }}>
              {stageLabel === "Foundation"
                ? `Let's spend a little time together, ${subjectName}.`
                : stageLabel === "Enriched"
                  ? `Let's go deeper, ${subjectName}.`
                  : `Let's capture what matters most, ${subjectName}.`}
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: C.ink2, margin: "20px 0 0", maxWidth: 480 }}>
              {aiVoice
                ? "This is a conversation to preserve your life story for your family — not a test. When you press start, your interviewer will briefly explain how it works, then begin."
                : stageLabel === "Foundation"
                  ? "I'll ask gentle questions about your life — identity, family, chapters, and what makes you you. Just talk; I'll listen and move us along when you're ready."
                  : stageLabel === "Enriched"
                    ? "This stage goes deeper into the stories, relationships, and wisdom behind your life. Take your time — each answer adds richness to your legacy."
                    : "This is the reflective stage — values, personality, gratitude, and what you want preserved for generations. Silence is welcome."}
            </p>
            {(aiVoice || stageLabel === "Foundation") && (
              <ul style={{
                listStyle: "none",
                margin: "22px 0 0",
                padding: 0,
                width: "100%",
                maxWidth: 420,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}>
                {[
                  `About ${TOTAL} topics in this stage — one conversation, at your pace`,
                  "Talk naturally; the interviewer may ask a gentle follow-up before moving on",
                  "Pause anytime, skip a topic if you want, or ask how far you are",
                  "When you finish, your answers help build your living legacy",
                ].map((line) => (
                  <li key={line} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, lineHeight: 1.45, color: C.ink2 }}>
                    <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: accent, marginTop: 7, flex: "none" }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}

            {pronouns && !changingIdentity ? (
              <div style={{
                marginTop: 26, width: "100%", maxWidth: 420, textAlign: "left",
                padding: "14px 16px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              }}>
                <span style={{ fontSize: 14, color: C.ink2 }}>Using {pronouns}</span>
                <button
                  type="button"
                  onClick={() => setChangingIdentity(true)}
                  style={{ background: "none", border: "none", color: C.ink3, fontFamily: sans, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
                >Change</button>
              </div>
            ) : (
            <div style={{
              marginTop: 26,
              width: "100%",
              maxWidth: 420,
              textAlign: "left",
              padding: "16px 16px 14px",
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderRadius: 4,
            }}>
              <div style={{ fontFamily: sans, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: C.ink3, fontWeight: 600 }}>
                How should we refer to you?
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.45, color: C.ink2, margin: "8px 0 0" }}>
                Required before starting — we never guess from your name.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 13, color: C.ink2, marginBottom: 8 }}>Gender</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([["female", "Female"], ["male", "Male"]] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={identityBusy}
                        onClick={() => {
                          const g = value as CreatorGender;
                          const p = pronouns || defaultPronounsForGender(g);
                          setGender(g);
                          setPronouns(p);
                          genderRef.current = g;
                          pronounsRef.current = p;
                          void persistIdentity(g, p).catch(() => {});
                        }}
                        style={{
                          flex: 1, padding: "10px 12px", borderRadius: 4, cursor: "pointer",
                          fontFamily: sans, fontSize: 14, fontWeight: 600,
                          background: gender === value ? accent : C.card,
                          color: gender === value ? "#fbf6ec" : C.ink,
                          border: `1px solid ${gender === value ? accent : C.line}`,
                        }}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: C.ink2, marginBottom: 8 }}>Pronouns</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([["she/her", "she/her"], ["he/him", "he/him"]] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={identityBusy}
                        onClick={() => {
                          const p = value as CreatorPronouns;
                          setPronouns(p);
                          pronounsRef.current = p;
                          void persistIdentity(gender, p).catch(() => {});
                        }}
                        style={{
                          flex: 1, padding: "10px 12px", borderRadius: 4, cursor: "pointer",
                          fontFamily: sans, fontSize: 14, fontWeight: 600,
                          background: pronouns === value ? accent : C.card,
                          color: pronouns === value ? "#fbf6ec" : C.ink,
                          border: `1px solid ${pronouns === value ? accent : C.line}`,
                        }}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              {identityError && (
                <div style={{ fontSize: 13, color: "#b04a3a", marginTop: 10 }}>{identityError}</div>
              )}
            </div>
            )}

            <button
              onClick={() => startVoice("guided")}
              disabled={identityBusy}
              style={{ cursor: identityBusy ? "wait" : "pointer", marginTop: 34, background: accent, color: "#fbf6ec", border: "none", fontFamily: sans, fontWeight: 600, fontSize: 17, padding: "18px 40px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 12, opacity: identityBusy ? 0.7 : 1 }}
            >
              <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 15 }}>
                <span style={{ width: 3, height: 7, background: "#fbf6ec", borderRadius: 2 }} />
                <span style={{ width: 3, height: 15, background: "#fbf6ec", borderRadius: 2 }} />
                <span style={{ width: 3, height: 10, background: "#fbf6ec", borderRadius: 2 }} />
              </span>
              {aiVoice ? "Start talking with your interviewer" : "Start the interview"}
            </button>
            <button onClick={() => startVoice("light")} disabled={identityBusy} style={{ cursor: identityBusy ? "wait" : "pointer", marginTop: 14, background: "transparent", border: `1px solid ${C.line}`, color: C.ink2, fontFamily: sans, fontWeight: 600, fontSize: 14, padding: "12px 20px", borderRadius: 4 }}>A lighter conversation</button>
            <button onClick={() => startVoice("free")} disabled={identityBusy} style={{ cursor: identityBusy ? "wait" : "pointer", marginTop: 10, background: "transparent", border: "none", color: C.ink3, fontFamily: sans, fontWeight: 600, fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3 }}>I just want to talk</button>
            <button onClick={startText} disabled={identityBusy} style={{ cursor: identityBusy ? "wait" : "pointer", marginTop: 12, background: "transparent", border: "none", color: C.ink3, fontFamily: sans, fontWeight: 500, fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3 }}>I'd rather type my answers</button>
            <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginTop: 30 }}>
              {TOTAL} topics · pause anytime · ask how far you are anytime
            </div>
          </div>
        )}

        {/* RUNNING */}
        {running && (
          <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            {/* progress */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 36, width: "100%", maxWidth: 360 }}>
              <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: C.ink3 }}>
                Topic {q + 1} of {TOTAL}
                {q < TOTAL - 1 ? ` · ${TOTAL - q - 1} left after this` : " · last topic"}
              </div>
              <div
                aria-hidden
                style={{ width: "100%", height: 4, borderRadius: 999, background: C.line, overflow: "hidden" }}
              >
                <div style={{
                  width: `${((q + 1) / TOTAL) * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: accent,
                  transition: "width .35s ease",
                }} />
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center" }}>
                {QS.map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < q ? C.umber : i === q ? accent : C.line }} />)}
              </div>
            </div>

            {/* orb */}
            <div style={{ position: "relative", width: 40, height: 40, marginBottom: 20 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ambient && (asking || (aiVoiceMode && convLive)) ? C.gold : "transparent", animation: ambient && (asking || (aiVoiceMode && convLive)) ? "la-ring 2.2s ease-out infinite" : "none" }} />
              <div style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", background: "radial-gradient(circle at 38% 34%, #d8b34d, #b3902f)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: "rgba(255,251,242,.85)" }} />
              </div>
            </div>

            {/* Current prompt / status — full conversation lives in the scroller below */}
            {aiVoiceMode ? (
              <div style={{ width: "100%", maxWidth: 560 }}>
                <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.ink3, marginBottom: 12 }}>
                  Topic theme · {cur.q}
                </div>
                <p style={{ fontFamily: serif, fontWeight: 300, fontSize: 26, lineHeight: 1.35, letterSpacing: "-.01em", margin: 0, color: C.ink, textWrap: "pretty" }}>
                  {partialAssistant
                    || [...chatTurns].reverse().find((t) => t.role === "assistant")?.text
                    || (convLive ? "I'm listening…" : "Connecting to your interviewer…")}
                </p>
              </div>
            ) : (
              <h1 className="legacy-interview-question" style={{ fontFamily: serif, fontWeight: 400, fontSize: 40, lineHeight: 1.16, letterSpacing: "-.015em", margin: 0, color: C.ink, textWrap: "pretty" }}>{cur.q}</h1>
            )}

            {/* mode toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "32px 0 16px" }}>
              <span style={{ fontSize: 13, color: C.ink3 }}>Answer by</span>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 3, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 999, padding: 4 }}>
                <button onClick={switchVoice} style={tab(voiceMode)}>
                  <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 10 }}>
                    <span style={{ width: 2, height: 5, background: "currentColor", borderRadius: 1 }} />
                    <span style={{ width: 2, height: 10, background: "currentColor", borderRadius: 1 }} />
                    <span style={{ width: 2, height: 7, background: "currentColor", borderRadius: 1 }} />
                  </span>Talking
                </button>
                <button onClick={switchText} style={tab(!voiceMode)}>
                  <span style={{ fontFamily: serif, fontSize: 13, lineHeight: 1 }}>Aa</span>Writing
                </button>
              </div>
            </div>

            {/* answer card */}
            <div style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: "0 18px 44px rgba(43,36,28,.08)", padding: "34px 32px", boxSizing: "border-box" }}>
              {voiceMode ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {aiVoiceMode ? (
                    <div
                      aria-hidden
                      style={{ position: "relative", width: 88, height: 88, borderRadius: "50%", background: micBg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 10px 26px ${micShadow}` }}
                    >
                      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ambient && convLive ? C.terra : "transparent", animation: ambient && convLive ? "la-ring 1.8s ease-out infinite" : "none" }} />
                      {convLive && (
                        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3, height: 30 }}>
                          {[0.5, 1, 0.7, 0.9, 0.6].map((h, i) => (
                            <span key={i} style={{ width: 4, height: 30, borderRadius: 2, transformOrigin: "center", background: "#fbf6ec", transform: `scaleY(${h})`, animation: ambient ? `la-eq ${(0.7 + i * 0.1).toFixed(2)}s ease-in-out infinite` : "none", animationDelay: `${(i * 0.08).toFixed(2)}s` }} />
                          ))}
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={toggleListen}
                      style={{ position: "relative", cursor: "pointer", border: "none", width: 88, height: 88, borderRadius: "50%", background: micBg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 10px 26px ${micShadow}` }}
                    >
                      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ambient && (listening || asking) ? (asking ? C.gold : C.terra) : "transparent", animation: ambient && (listening || asking) ? "la-ring 1.8s ease-out infinite" : "none" }} />
                      {listening && (
                        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3, height: 30 }}>
                          {[0.5, 1, 0.7, 0.9, 0.6].map((h, i) => (
                            <span key={i} style={{ width: 4, height: 30, borderRadius: 2, transformOrigin: "center", background: "#fbf6ec", transform: `scaleY(${h})`, animation: ambient ? `la-eq ${(0.7 + i * 0.1).toFixed(2)}s ease-in-out infinite` : "none", animationDelay: `${(i * 0.08).toFixed(2)}s` }} />
                          ))}
                        </span>
                      )}
                      {asking && <span style={{ position: "relative", width: 16, height: 16, borderRadius: "50%", background: "#fbf6ec", animation: "la-breathe 1.4s ease-in-out infinite" }} />}
                      {doneV && <span style={{ position: "relative", fontSize: 34, color: "#fbf6ec", lineHeight: 1 }}>✓</span>}
                    </button>
                  )}
                  <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: statusColor, marginTop: 18 }}>{statusLabel}</div>
                  <button
                    type="button"
                    onClick={togglePause}
                    style={{
                      cursor: "pointer",
                      marginTop: 16,
                      background: paused ? C.ink : "transparent",
                      color: paused ? C.paper : C.ink2,
                      border: `1px solid ${paused ? C.ink : C.line}`,
                      fontFamily: sans,
                      fontWeight: 600,
                      fontSize: 14,
                      padding: "10px 22px",
                      borderRadius: 999,
                    }}
                  >
                    {paused ? "Resume interview" : "Pause interview"}
                  </button>
                  {aiError && (
                    <p style={{ fontSize: 14, color: C.terra, margin: "12px 0 0", textAlign: "center" }}>{aiError}</p>
                  )}
                  {!aiVoiceMode && transcript && (
                    <p style={{ fontFamily: serif, fontWeight: 300, fontSize: 20, lineHeight: 1.55, color: C.ink, margin: "20px 0 0", textAlign: "left", width: "100%" }}>
                      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, display: "block", marginBottom: 8 }}>Your words so far</span>
                      {transcript}
                    </p>
                  )}
                </div>
              ) : (
                <textarea
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Type your answer here… there's no rush, and no wrong way to say it."
                  style={{ width: "100%", minHeight: 150, border: "none", outline: "none", resize: "none", background: "transparent", fontFamily: serif, fontWeight: 300, fontSize: 21, lineHeight: 1.6, color: C.ink, boxSizing: "border-box" }}
                />
              )}
            </div>

            {/* reassurance */}
            <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 16, color: C.ink3, margin: "22px 0 0" }}>{reassurance}</p>

            {/* actions */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: 24 }}>
              {!voiceMode && (
                <button onClick={goNext} disabled={!answered} style={{ cursor: answered ? "pointer" : "default", background: answered ? C.ink : C.panel, color: answered ? C.paper : C.ink3, border: "none", fontFamily: sans, fontWeight: 600, fontSize: 15, padding: "15px 34px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 11, opacity: answered ? 1 : 0.7 }}>
                  {lastQ ? "Finish for today" : "Next question"}<span>→</span>
                </button>
              )}
              <button onClick={() => void goNext()} style={{ cursor: "pointer", background: "transparent", border: "none", color: C.ink3, fontFamily: sans, fontWeight: 500, fontSize: 13.5, textDecoration: "underline", textUnderlineOffset: 3 }}>
                {lastQ ? "Finish for today →" : "Skip this question →"}
              </button>
            </div>

            {/* Conversation transcript — below controls, designed scroller */}
            {aiVoiceMode && (
              <div style={{ width: "100%", marginTop: 36, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: C.ink3 }}>
                    Conversation
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: C.ink3 }}>
                    Scroll for earlier lines
                  </div>
                </div>
                <div
                  className="legacy-interview-chat-scroll"
                  ref={chatScrollRef}
                  style={{
                    position: "relative",
                    maxHeight: 260,
                    overflowY: "auto",
                    overflowX: "hidden",
                    padding: "18px 18px 16px",
                    borderRadius: 14,
                    border: `1px solid ${C.line}`,
                    background: `linear-gradient(180deg, ${C.card} 0%, ${C.panel} 100%)`,
                    boxShadow: "inset 0 1px 0 rgba(255,251,242,.55)",
                    scrollBehavior: "smooth",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {chatTurns.length === 0 && !partialAssistant && !partialUser ? (
                    <p style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 300, fontSize: 16, lineHeight: 1.5, margin: 0, color: C.ink3, textAlign: "center" }}>
                      {convLive ? "Lines will appear here as you talk." : "Connecting…"}
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {chatTurns.map((turn) => (
                        <div key={turn.id}>
                          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: turn.role === "assistant" ? C.terra : C.ink3, marginBottom: 5 }}>
                            {turn.role === "assistant" ? "Interviewer" : "You"}
                          </div>
                          <p style={{ fontFamily: serif, fontWeight: 300, fontSize: turn.role === "assistant" ? 18 : 16, lineHeight: 1.45, margin: 0, color: C.ink, textWrap: "pretty" }}>
                            {turn.text}
                          </p>
                        </div>
                      ))}
                      {partialAssistant && (
                        <div>
                          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: C.terra, marginBottom: 5 }}>Interviewer</div>
                          <p style={{ fontFamily: serif, fontWeight: 300, fontSize: 18, lineHeight: 1.45, margin: 0, color: C.ink, textWrap: "pretty" }}>
                            {partialAssistant}
                          </p>
                        </div>
                      )}
                      {partialUser && (
                        <div>
                          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginBottom: 5 }}>You</div>
                          <p style={{ fontFamily: serif, fontWeight: 300, fontSize: 16, lineHeight: 1.45, margin: 0, color: C.ink, textWrap: "pretty" }}>
                            {partialUser}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* COMPLETE */}
        {complete && (
          <div style={{ width: "100%", maxWidth: 560, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {processing ? (
              <>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 26, animation: "la-breathe 1.4s ease-in-out infinite" }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#fbf6ec" }} />
                </div>
                <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 32, lineHeight: 1.15, margin: 0, color: C.ink }}>Preserving your legacy…</h1>
                <p style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 300, fontSize: 18, lineHeight: 1.5, color: C.ink2, margin: "18px 0 0" }}>
                  Your interview is finished. We're extracting your stories, values, and wisdom — this usually takes under a minute.
                </p>
              </>
            ) : (
              <>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.sage, color: "#fbf6ec", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 26 }}>✓</div>
                <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 38, lineHeight: 1.15, margin: 0, color: C.ink }}>Thank you, {subjectName}.</h1>
                <p style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 300, fontSize: 20, lineHeight: 1.5, color: C.ink2, margin: "18px 0 0" }}>
                  {processingError
                    ? processingError
                    : archiveLocked
                      ? "We kept what you recorded. To see the stories, people, and wisdom, you need to pay."
                      : extractionResult
                        ? "We've extracted your stories, relationships, and wisdom. Your legacy dashboard is updated."
                        : "This is your legacy. From here you can invite the people you trust — add an administrator to help manage it, and they can invite the rest of the family."}
                </p>
                {processingError && onRetryPreservation && (
                  <button
                    onClick={onRetryPreservation}
                    disabled={processing}
                    style={{ cursor: "pointer", marginTop: 22, background: C.ink, color: C.paper, border: "none", fontFamily: sans, fontWeight: 600, fontSize: 14, padding: "14px 26px", borderRadius: 999, opacity: processing ? 0.6 : 1 }}
                  >
                    {processing ? "Preserving…" : "Try preserving again"}
                  </button>
                )}
                {extractionResult && !archiveLocked && (
                  <div style={{ marginTop: 28, padding: "24px 28px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, textAlign: "left", width: "100%", boxSizing: "border-box" }}>
                    {extractionResult.session_summary && (
                      <p style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.55, color: C.ink, margin: 0 }}>{extractionResult.session_summary}</p>
                    )}
                    {extractionResult.counts && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                        {[
                          { label: "Stories", n: extractionResult.counts.memories },
                          { label: "People", n: extractionResult.counts.relationships },
                          { label: "Values", n: extractionResult.counts.values },
                          { label: "Wisdom", n: extractionResult.counts.wisdom },
                          { label: "Threads", n: extractionResult.counts.threads },
                        ].map(({ label, n }) => (
                          <span key={label} style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 999, padding: "6px 12px", color: C.ink2 }}>
                            {n} {label}
                          </span>
                        ))}
                      </div>
                    )}
                    {extractionResult.completion_score != null && (
                      <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: C.terra, marginTop: 16 }}>
                        Archive setup: {extractionResult.completion_score}% complete
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 13, marginTop: 34, flexWrap: "wrap", justifyContent: "center" }}>
                  {(onViewLegacy != null || onViewAvatar != null) && (
                    <button onClick={onViewLegacy ?? onViewAvatar} style={{ cursor: "pointer", background: C.ink, color: C.paper, border: "none", fontFamily: sans, fontWeight: 600, fontSize: 14, padding: "14px 26px", borderRadius: 999 }}>
                      {archiveLocked ? "See what you need to pay →" : "Open your archive →"}
                    </button>
                  )}
                  {!archiveLocked && (
                    <button onClick={onManageAccess} style={{ cursor: "pointer", background: "transparent", border: `1px solid ${C.line}`, color: C.ink2, fontFamily: sans, fontWeight: 500, fontSize: 14, padding: "14px 24px", borderRadius: 999 }}>Invite family</button>
                  )}
                  {!archiveLocked && onViewLegacy != null && onViewAvatar != null && (
                    <button onClick={onViewAvatar} style={{ cursor: "pointer", background: "transparent", border: `1px solid ${C.line}`, color: C.ink2, fontFamily: sans, fontWeight: 500, fontSize: 14, padding: "14px 24px", borderRadius: 999 }}>Ask the archive</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
