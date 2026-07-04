import type { SttFn, TtsFn } from '../components/InterviewSession';

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

/** Browser SpeechSynthesis — speaks the question, resolves when done */
export const browserTts: TtsFn = (text) =>
  new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      setTimeout(resolve, 1400);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });

/**
 * Browser Web Speech API — streams partial transcript.
 * - Interview (default): auto-stops after silenceMs of no new speech.
 * - Live call (manualStop): runs until stop() is called; ignores no-speech timeouts.
 */
export const browserStt: SttFn = ({ onPartial, onFinal, onError, manualStop = false, silenceMs = 3500 }) => {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;

  if (!SR) return;

  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = true;

  let finalText = '';
  let lastInterim = '';
  let stoppedByUser = false;
  let finished = false;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = null;
  };

  const scheduleSilenceStop = () => {
    if (manualStop) return;
    clearSilence();
    silenceTimer = setTimeout(() => {
      try { rec.stop(); } catch { /* ignore */ }
    }, silenceMs);
  };

  const combined = () => (finalText + lastInterim).trim();

  const finish = () => {
    if (finished) return;
    finished = true;
    clearSilence();
    onFinal(combined());
  };

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t + ' ';
      else interim += t;
    }
    lastInterim = interim;
    onPartial(combined());
    scheduleSilenceStop();
  };

  rec.onend = () => {
    clearSilence();
    // Chrome ends the session periodically even with continuous:true — restart while the
    // user is still holding the call open so speech isn't cut off.
    if (manualStop && !stoppedByUser) {
      try { rec.start(); return; } catch { /* fall through to finish */ }
    }
    finish();
  };

  rec.onerror = (e) => {
    onError?.(e.error);
    if (e.error === 'aborted') return;
    // Recoverable hiccups: keep going in manual mode instead of ending the turn.
    if (manualStop && !stoppedByUser && (e.error === 'no-speech' || e.error === 'network' || e.error === 'audio-capture')) {
      try { rec.start(); return; } catch { /* fall through */ }
    }
    finish();
  };

  try {
    rec.start();
  } catch {
    finish();
    return;
  }

  if (!manualStop) scheduleSilenceStop();

  return () => {
    stoppedByUser = true;
    clearSilence();
    try { rec.stop(); } catch { /* ignore */ }
  };
};
