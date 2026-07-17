import { useEffect, useRef, useState } from "react";
import StageProgressTrack from "./StageProgressTrack";
import { unlockAudioPlayback, createOpenAiRealtimeInterview, fetchRealtimeInstructions, type RealtimeVoiceInterview } from "../lib/openaiRealtimeInterview";
import { isSkipIntent, shouldAcceptTopicAdvance } from "../lib/interviewDepth";

/**
 * Legacy AI — Interview Session
 * A hands-free, one-question-at-a-time interview. Press Start once and it walks
 * the speaker through every question: asks → listens → confirms → auto-advances.
 * Writing mode is manual (type + Next).
 */

export interface Question {
  q: string;
  a?: string;
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
  questionIndex: number;
  totalQuestions: number;
  /** Answers already captured — used so the interviewer can bridge topics. */
  priorTopics?: PriorTopic[];
};

export interface AiVoiceInterview {
  connect: (ctx: ConductorContext) => Promise<void>;
  disconnect: () => void;
  updateInstructions: (instructions: string) => void;
  completeFunctionCall: (callId: string, output: unknown, options?: { instructions?: string; continueResponse?: boolean; nextQuestionIndex?: number }) => void;
  transitionToTopic: (instructions: string, questionIndex: number) => void;
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
  autoStart?: boolean;
  accent?: string;
  ambient?: boolean;
  tts?: TtsFn | null;
  stt?: SttFn | null;
  /** When true, voice mode uses OpenAI Realtime API (WebRTC speech-to-speech). */
  aiVoice?: boolean;
  interviewStage?: string;
  onAnswerCommit?: (answer: Answer & { questionIndex: number; skipped: boolean }) => void | Promise<void>;
  onComplete?: (answers: Answer[]) => void | Promise<void>;
  onViewAvatar?: () => void;
  onViewLegacy?: () => void;
  onManageAccess?: () => void;
  onBack?: () => void;
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

const C = {
  paper: "#ece3d2", panel: "#f4ecdc", card: "#fbf6ec",
  ink: "#2b241c", ink2: "#6e6253", ink3: "#9a8d79", line: "#ddccb0",
  terra: "#c06a44", umber: "#7a5236", gold: "#b3902f", sage: "#71805c",
};
const serif = "'Newsreader', Georgia, serif";
const sans  = "'Hanken Grotesk', system-ui, sans-serif";
const mono  = "'Spline Sans Mono', ui-monospace, monospace";

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
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300;1,6..72,400&family=Hanken+Grotesk:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes la-ring { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.85);opacity:0} }
      @keyframes la-eq { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
      @keyframes la-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
      @keyframes la-rec { 0%,100%{opacity:1} 50%{opacity:.3} }
      @keyframes la-breathe { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.25);opacity:.55} }
      .legacy-interview ::selection { background:#c06a44; color:#fbf6ec }
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
  autoStart = false,
  accent = C.terra,
  ambient = true,
  tts = null,
  stt = null,
  aiVoice = false,
  interviewStage = "foundation",
  onAnswerCommit,
  onComplete = (a) => console.log("interview complete", a),
  onViewAvatar,
  onViewLegacy,
  onManageAccess = () => {},
  onBack,
  processing = false,
  processingError = null,
  onRetryPreservation,
  extractionResult = null,
}: InterviewSessionProps) {
  useInjectedHead();

  const QS    = questions;
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
  const [liveLine,   setLiveLine]   = useState("");
  const [aiError,    setAiError]    = useState<string | null>(null);

  const answersRef  = useRef<Answer[]>([]);
  const sttStopRef  = useRef<(() => void) | null>(null);
  const simIdxRef   = useRef(0);
  const realtimeRef = useRef<RealtimeVoiceInterview | null>(null);
  const activeQuestionRef = useRef(initialQuestionIndex);
  const userTurnsRef = useRef(0);
  const lastUserUtteranceRef = useRef('');
  const skippingRef = useRef(false);
  const prevModeRef = useRef<Mode>(mode);
  const seededAnswersRef = useRef(false);

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

  const stopConversation = () => {
    realtimeRef.current?.disconnect();
    realtimeRef.current = null;
    setConvLive(false);
  };

  const priorTopicsFor = (questionIndex: number): PriorTopic[] =>
    answersRef.current
      .slice(0, questionIndex)
      .filter((a): a is Answer => Boolean(a?.answer?.trim()))
      .map((a) => ({ question: a.question, summary: a.answer }));

  const ctxFor = (questionIndex: number): ConductorContext => ({
    subjectName,
    stage: interviewStage,
    anchorQuestion: QS[questionIndex]?.q || '',
    questionIndex,
    totalQuestions: TOTAL,
    priorTopics: priorTopicsFor(questionIndex),
  });

  const handleRealtimeAdvance = async (questionIndex: number, summary: string, callId: string) => {
    if (skippingRef.current) {
      realtimeRef.current?.completeFunctionCall(
        callId,
        { ok: true, message: 'Topic already skipped.' },
        { continueResponse: false },
      );
      return;
    }
    const answer = summary.trim();
    const skipped = isSkipIntent(answer) || isSkipIntent(lastUserUtteranceRef.current);
    const depth = shouldAcceptTopicAdvance({
      summary: answer,
      userTurns: userTurnsRef.current,
      userUtterance: lastUserUtteranceRef.current,
      stage: interviewStage,
    });

    if (!depth.ok) {
      realtimeRef.current?.completeFunctionCall(callId, {
        ok: false,
        continue: true,
        message: depth.message,
      });
      return;
    }

    const savedAnswer = skipped ? '' : answer;
    setTranscript(savedAnswer);
    answersRef.current[questionIndex] = { question: QS[questionIndex].q, answer: savedAnswer, mode: "voice" };
    userTurnsRef.current = 0;
    lastUserUtteranceRef.current = '';

    if (onAnswerCommit) {
      await onAnswerCommit({
        questionIndex,
        question: QS[questionIndex].q,
        answer: savedAnswer,
        mode: "voice",
        skipped,
      });
    }

    if (questionIndex < TOTAL - 1) {
      const next = questionIndex + 1;
      setQ(next);
      setLiveLine("");
      const instructions = await fetchRealtimeInstructions(ctxFor(next));
      // Apply next-topic instructions before the model speaks again (avoids racing on old prompt).
      realtimeRef.current?.completeFunctionCall(
        callId,
        {
          ok: true,
          message: skipped
            ? `They skipped this topic. New instructions are loaded for topic ${next + 1} of ${TOTAL}. Acknowledge briefly and open the next topic warmly.`
            : `Topic saved. New instructions are loaded for topic ${next + 1} of ${TOTAL}. Transition warmly — a soft progress cue in plain language (topic ${next + 1} of ${TOTAL}), bridge from their story if it fits, then ask the next topic in your own words. Never say "next question" or sound like a checklist. Do not re-welcome them.`,
        },
        { instructions, nextQuestionIndex: next },
      );
    } else {
      realtimeRef.current?.completeFunctionCall(callId, { ok: true, complete: true });
      setComplete(true);
      stopConversation();
      await onComplete(answersRef.current.filter(Boolean));
    }
  };

  const skipCurrentTopic = async () => {
    if (!running || complete || skippingRef.current) return;
    skippingRef.current = true;
    try {
      const questionIndex = activeQuestionRef.current;
      answersRef.current[questionIndex] = { question: QS[questionIndex].q, answer: '', mode: 'voice' };

      if (onAnswerCommit) {
        await onAnswerCommit({
          questionIndex,
          question: QS[questionIndex].q,
          answer: '',
          mode: 'voice',
          skipped: true,
        });
      }

      userTurnsRef.current = 0;
      lastUserUtteranceRef.current = '';
      setTranscript('');
      setLiveLine('');

      if (questionIndex < TOTAL - 1) {
        const next = questionIndex + 1;
        setQ(next);
        if (aiVoiceMode && realtimeRef.current) {
          const instructions = await fetchRealtimeInstructions(ctxFor(next));
          realtimeRef.current.transitionToTopic(instructions, next);
        } else {
          stopConversation();
          void startRealtimeConversation(next);
        }
      } else {
        stopConversation();
        setComplete(true);
        await onComplete(answersRef.current.filter(Boolean));
      }
    } finally {
      skippingRef.current = false;
    }
  };

  const startRealtimeConversation = async (questionIndex: number) => {
    if (!aiVoice) return;
    stopConversation();
    setAiError(null);
    userTurnsRef.current = 0;

    const client = createOpenAiRealtimeInterview({
      onLiveLine: (text, role) => {
        if (role === 'user' && text.trim()) {
          lastUserUtteranceRef.current = text.trim();
          userTurnsRef.current += 1;
          if (isSkipIntent(text) && !skippingRef.current) {
            void skipCurrentTopic();
          }
        }
        setLiveLine(text);
      },
      onConnected: () => setConvLive(true),
      onError: (msg) => {
        setAiError(msg);
        stopConversation();
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
      setTranscript("");
      setLiveLine("");
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
    setPaused((p) => {
      const next = !p;
      if (aiVoiceMode) {
        if (next) realtimeRef.current?.pause();
        else realtimeRef.current?.resume();
      } else if (next && sttStopRef.current) {
        sttStopRef.current();
        sttStopRef.current = null;
      }
      return next;
    });
  };

  const goNextWithAnswer = async (answerOverride?: string) => {
    const answer = answerOverride ?? (voiceMode ? transcript : typed);
    const skipped = !answer.trim();
    answersRef.current[q] = { question: cur.q, answer, mode };

    if (onAnswerCommit) {
      await onAnswerCommit({
        questionIndex: q,
        question: cur.q,
        answer,
        mode,
        skipped,
      });
    }

    if (sttStopRef.current) { sttStopRef.current(); sttStopRef.current = null; }
    stopConversation();
    if (q < TOTAL - 1) {
      const next = q + 1;
      setQ(next);
      setTranscript("");
      setTyped("");
      setLiveLine("");
      simIdxRef.current = 0;
      if (aiVoiceMode) {
        void startRealtimeConversation(next);
      } else {
        setPhase("asking");
      }
    } else {
      setComplete(true);
      await onComplete(answersRef.current.filter(Boolean));
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

  /* controls */
  const startVoice  = () => {
    unlockAudioPlayback();
    setStarted(true); setMode("voice"); setQ(initialQuestionIndex); setSecs(0); setComplete(false);
    setTranscript(""); setLiveLine(""); setAiError(null); simIdxRef.current = 0;
    if (aiVoice) void startRealtimeConversation(initialQuestionIndex);
    else setPhase("asking");
  };
  const startText   = () => { stopConversation(); setStarted(true); setMode("text");  setQ(initialQuestionIndex); setSecs(0); setComplete(false); setPhase("asking"); setTyped(""); };
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
  const reassurance  = paused ? "Paused. Nothing is lost — take your time."
    : voiceMode
      ? aiVoiceMode
        ? "Just talk — I'll listen and guide us to the next question when you're ready."
        : asking    ? "Listen for the question, then answer in your own words."
        : listening ? "I'll move us along when you're done — or tap the circle to finish sooner."
        : "One moment — the next question is coming up."
      : "Write as much or as little as you like.";

  const Mark = ({ size = 24, border, color, font = 13 }: { size?: number; border: string; color: string; font?: number }) => (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: font, color }}>H</div>
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
    <div className="legacy-interview" style={{
      minHeight: "100vh", background: C.paper,
      backgroundImage: "radial-gradient(1000px 560px at 50% -14%, rgba(255,251,242,.72), transparent 62%)",
      fontFamily: sans, color: C.ink, display: "flex", flexDirection: "column", WebkitFontSmoothing: "antialiased",
    }}>
      {/* TOP BAR */}
      <div style={{ flex: "none", borderBottom: `1px solid ${C.line}` }}>
        <div className="legacy-interview-top" style={{ maxWidth: 920, margin: "0 auto", padding: "0 28px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark border={C.umber} color={C.umber} />
            <div className="legacy-interview-brand" style={{ fontFamily: serif, fontSize: 19, color: C.ink }}>Legacy AI</div>
          </div>
          <div className="legacy-interview-status" style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, display: "flex", alignItems: "center", gap: 7 }}>
            {running ? (
              <>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.terra, animation: ambient && !paused ? "la-rec 1.4s ease-in-out infinite" : "none" }} />
                <span style={{ color: C.terra }}>Topic {q + 1}/{TOTAL}</span>
                <span style={{ color: C.line }}>·</span>
                <span>{elapsed}</span>
              </>
            ) : <span>{stageLabel} · {sessionLabel}</span>}
          </div>
          <div style={{ minWidth: 78, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            {running && (
              <button onClick={togglePause} style={{ cursor: "pointer", background: "transparent", border: `1px solid ${C.line}`, color: C.ink2, fontFamily: sans, fontWeight: 500, fontSize: 13, padding: "8px 16px", borderRadius: 999 }}>{paused ? "Resume" : "Pause"}</button>
            )}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{ cursor: "pointer", background: C.card, border: `1px solid ${C.line}`, color: C.ink2, fontFamily: sans, fontWeight: 500, fontSize: 13, padding: "8px 16px", borderRadius: 999, boxShadow: "0 2px 8px rgba(43,36,28,.06)", whiteSpace: "nowrap" }}
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
      <div className="legacy-interview-main" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px 56px", boxSizing: "border-box" }}>

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
            <button onClick={startVoice} style={{ cursor: "pointer", marginTop: 34, background: accent, color: "#fbf6ec", border: "none", fontFamily: sans, fontWeight: 600, fontSize: 17, padding: "18px 40px", borderRadius: 999, boxShadow: "0 12px 28px rgba(192,106,68,.32)", display: "inline-flex", alignItems: "center", gap: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 15 }}>
                <span style={{ width: 3, height: 7, background: "#fbf6ec", borderRadius: 2 }} />
                <span style={{ width: 3, height: 15, background: "#fbf6ec", borderRadius: 2 }} />
                <span style={{ width: 3, height: 10, background: "#fbf6ec", borderRadius: 2 }} />
              </span>
              {aiVoice ? "Start talking with your interviewer" : "Start the interview"}
            </button>
            <button onClick={startText} style={{ cursor: "pointer", marginTop: 16, background: "transparent", border: "none", color: C.ink3, fontFamily: sans, fontWeight: 500, fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3 }}>I'd rather type my answers</button>
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

            {/* question / interviewer */}
            {aiVoiceMode ? (
              liveLine ? (
                <p style={{ fontFamily: serif, fontWeight: 300, fontSize: 28, lineHeight: 1.35, letterSpacing: "-.01em", margin: 0, color: C.ink, textWrap: "pretty", maxWidth: 560 }}>{liveLine}</p>
              ) : (
                <p style={{ fontFamily: serif, fontWeight: 300, fontSize: 22, lineHeight: 1.4, margin: 0, color: C.ink2, textWrap: "pretty", maxWidth: 560 }}>
                  {convLive ? "I'm listening…" : "Connecting to your interviewer…"}
                </p>
              )
            ) : (
              <h1 className="legacy-interview-question" style={{ fontFamily: serif, fontWeight: 400, fontSize: 40, lineHeight: 1.16, letterSpacing: "-.015em", margin: 0, color: C.ink, textWrap: "pretty" }}>{cur.q}</h1>
            )}
            {aiVoiceMode && (
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.ink3, marginTop: 14 }}>
                Topic {q + 1}: {cur.q}
              </div>
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
                  {transcript && (
                    <p style={{ fontFamily: serif, fontWeight: 300, fontSize: 20, lineHeight: 1.55, color: C.ink, margin: "20px 0 0", textAlign: "left", width: "100%" }}>
                      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, display: "block", marginBottom: 8 }}>Your words so far</span>
                      {transcript}
                      <span style={{ color: C.terra, animation: (listening || (aiVoiceMode && convLive)) ? "la-blink 1s step-end infinite" : "none", opacity: (listening || (aiVoiceMode && convLive)) ? 1 : 0 }}>▏</span>
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
                <p style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 300, fontSize: 18, lineHeight: 1.5, color: C.ink2, margin: "18px 0 0" }}>We're reading through everything you shared — extracting your stories, values, and wisdom.</p>
              </>
            ) : (
              <>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.sage, color: "#fbf6ec", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 26 }}>✓</div>
                <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 38, lineHeight: 1.15, margin: 0, color: C.ink }}>Thank you, {subjectName}.</h1>
                <p style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 300, fontSize: 20, lineHeight: 1.5, color: C.ink2, margin: "18px 0 0" }}>
                  {processingError
                    ? processingError
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
                {extractionResult && (
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
                        Legacy completion: {extractionResult.completion_score}%
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 13, marginTop: 34, flexWrap: "wrap", justifyContent: "center" }}>
                  {(onViewLegacy != null || onViewAvatar != null) && (
                    <button onClick={onViewLegacy ?? onViewAvatar} style={{ cursor: "pointer", background: C.ink, color: C.paper, border: "none", fontFamily: sans, fontWeight: 600, fontSize: 14, padding: "14px 26px", borderRadius: 999 }}>
                      See your updated legacy →
                    </button>
                  )}
                  <button onClick={onManageAccess} style={{ cursor: "pointer", background: "transparent", border: `1px solid ${C.line}`, color: C.ink2, fontFamily: sans, fontWeight: 500, fontSize: 14, padding: "14px 24px", borderRadius: 999 }}>Add administrators &amp; invite family</button>
                  {onViewLegacy != null && onViewAvatar != null && (
                    <button onClick={onViewAvatar} style={{ cursor: "pointer", background: "transparent", border: `1px solid ${C.line}`, color: C.ink2, fontFamily: sans, fontWeight: 500, fontSize: 14, padding: "14px 24px", borderRadius: 999 }}>Preview avatar</button>
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
