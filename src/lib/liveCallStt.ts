/**
 * Live-call speech input — mic warmup + Web Speech API, tuned for Windows/Chrome.
 * Returns null when unsupported; throws on permission denied.
 */

export type LiveCallSttSession = {
  stop: () => void;
  /** Best transcript so far (interim + final). */
  getTranscript: () => string;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Open the microphone — required on many systems before SpeechRecognition works. */
export async function openLiveCallMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
}

/**
 * Start listening. Call `stop()` when the user taps Send.
 * Mic stream must stay active until stop() (pass the stream from openLiveCallMic).
 */
export function startLiveCallStt(
  micStream: MediaStream,
  handlers: {
    onPartial: (text: string) => void;
    onError?: (code: string) => void;
  },
): LiveCallSttSession | null {
  const SR = getSpeechRecognitionCtor();
  if (!SR) return null;

  const rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.continuous = true;

  let finalText = '';
  let interimText = '';
  let stopped = false;
  let restarting = false;

  const transcript = () => (finalText + interimText).trim();

  const push = () => handlers.onPartial(transcript());

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const piece = e.results[i][0]?.transcript ?? '';
      if (e.results[i].isFinal) finalText += piece + ' ';
      else interim += piece;
    }
    interimText = interim;
    push();
  };

  const safeStart = () => {
    if (stopped) return;
    try {
      rec.start();
    } catch {
      /* already started — ignore */
    }
  };

  rec.onend = () => {
    if (stopped || restarting) return;
    // Chrome on Windows ends sessions often — restart without clearing transcript.
    restarting = true;
    window.setTimeout(() => {
      restarting = false;
      if (!stopped) safeStart();
    }, 200);
  };

  rec.onerror = (e) => {
    handlers.onError?.(e.error);
    if (e.error === 'aborted') return;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      stopped = true;
      return;
    }
    // Benign — keep session alive in manual mode.
    if (e.error === 'no-speech' || e.error === 'network' || e.error === 'audio-capture') {
      if (!stopped) safeStart();
    }
  };

  safeStart();

  return {
    getTranscript: transcript,
    stop: () => {
      if (stopped) return;
      stopped = true;
      try { rec.stop(); } catch { /* ignore */ }
      // Keep micStream alive for the next Speak tap — caller stops tracks on end call.
      void micStream;
    },
  };
}
