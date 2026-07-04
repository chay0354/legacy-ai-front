const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SILENCE_MS = 2800;
const MIN_SPEECH_MS = 400;
const RMS_THRESHOLD = 0.016;
const CHECK_MS = 80;
const MAX_UTTERANCE_MS = 180_000;

let cachedAuth: { token: string; expiresAtMs: number } | null = null;
let activeAudio: HTMLAudioElement | null = null;
let cancelActiveListen: (() => void) | null = null;
let unlockedAudio = false;

async function authHeaders(json = true) {
  const now = Date.now();
  if (!cachedAuth || cachedAuth.expiresAtMs <= now + 60_000) {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    cachedAuth = {
      token: session.access_token,
      expiresAtMs: (session.expires_at ?? 0) * 1000,
    };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cachedAuth.token}`,
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Call once from a user gesture so browser allows audio playback. */
export function unlockAudioPlayback() {
  if (unlockedAudio) return;
  unlockedAudio = true;
  try {
    const ctx = new AudioContext();
    void ctx.resume().then(() => ctx.close());
  } catch { /* ignore */ }
}

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.onended = null;
    activeAudio.ontimeupdate = null;
    activeAudio = null;
  }
}

function estimateSpeechMs(text: string) {
  const chars = text.length;
  return Math.min(120_000, Math.max(4_000, chars * 72));
}

async function playMp3Blob(blob: Blob, captionText: string) {
  const url = URL.createObjectURL(blob);
  const maxMs = estimateSpeechMs(captionText);

  return new Promise<void>((resolve) => {
    stopActiveAudio();
    const audio = new Audio(url);
    activeAudio = audio;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };

    audio.onended = finish;
    audio.onerror = finish;
    audio.ontimeupdate = () => {
      if (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration - 0.2) {
        finish();
      }
    };

    const timer = setTimeout(finish, maxMs);

    audio.play()
      .then(() => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          clearTimeout(timer);
          setTimeout(finish, audio.duration * 1000 + 500);
        }
      })
      .catch(finish);
  });
}

function pickMimeType() {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return 'audio/mp4';
}

function listenForUtterance(opts?: { silenceMs?: number }): Promise<Blob | null> {
  const silenceMs = opts?.silenceMs ?? SILENCE_MS;

  return new Promise((resolve, reject) => {
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let chunks: BlobPart[] = [];
    let audioContext: AudioContext | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let finished = false;

    const finish = (blob: Blob | null) => {
      if (finished) return;
      finished = true;
      cancelActiveListen = null;
      if (intervalId) clearInterval(intervalId);
      if (recorder?.state === 'recording') {
        try { recorder.stop(); } catch { /* ignore */ }
      }
      stream?.getTracks().forEach((t) => t.stop());
      void audioContext?.close().catch(() => undefined);
      resolve(blob);
    };

    const stopWithBlob = () => {
      if (!recorder || recorder.state === 'inactive') {
        finish(null);
        return;
      }
      recorder.onstop = () => {
        const type = recorder?.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        finish(blob.size > 300 ? blob : null);
      };
      try { recorder.stop(); } catch { finish(null); }
    };

    cancelActiveListen = () => finish(null);

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        const mime = pickMimeType();
        chunks = [];
        recorder = new MediaRecorder(stream, { mimeType: mime });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.start(200);

        audioContext = new AudioContext();
        await audioContext.resume();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        const buf = new Uint8Array(analyser.fftSize);
        let speechStarted = false;
        let speechStartTime = 0;
        let lastSpeechTime = 0;
        const listenStart = Date.now();

        intervalId = setInterval(() => {
          if (finished) return;

          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const n = (buf[i] - 128) / 128;
            sum += n * n;
          }
          const rms = Math.sqrt(sum / buf.length);
          const now = Date.now();

          if (rms > RMS_THRESHOLD) {
            if (!speechStarted) {
              speechStarted = true;
              speechStartTime = now;
            }
            lastSpeechTime = now;
          }

          const utteranceTimedOut = now - listenStart > MAX_UTTERANCE_MS;
          const silenceAfterSpeech =
            speechStarted &&
            now - lastSpeechTime >= silenceMs &&
            now - speechStartTime >= MIN_SPEECH_MS;

          if (silenceAfterSpeech || (utteranceTimedOut && speechStarted)) {
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
            stopWithBlob();
          }
        }, CHECK_MS);
      } catch (e) {
        if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotFoundError')) {
          finished = true;
          cancelActiveListen = null;
          reject(e);
          return;
        }
        finish(null);
      }
    })();
  });
}

export type ConductorContext = {
  subjectName: string;
  stage: string;
  anchorQuestion: string;
  questionIndex: number;
  totalQuestions: number;
};

type Turn = { role: 'assistant' | 'user'; text: string };

export async function checkAiVoiceAvailable(): Promise<boolean> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/interview/voice/status`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.available);
  } catch {
    return false;
  }
}

export function createAiVoiceInterview() {
  return {
    listenForUtterance,

    cancelListening: () => {
      cancelActiveListen?.();
      cancelActiveListen = null;
    },

    stopSpeaking: () => stopActiveAudio(),

    speak: async (text: string) => {
      const trimmed = String(text || '').trim();
      if (!trimmed) return;

      const headers = await authHeaders();
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 45_000);

      let res: Response;
      try {
        res = await fetch(`${API_URL}/api/interview/voice/speak`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ text: trimmed }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(fetchTimer);
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Speak failed ${res.status}`);
      }

      const blob = await res.blob();
      await playMp3Blob(blob, trimmed);
    },

    transcribe: async (blob: Blob) => {
      const audio = await blobToBase64(blob);
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/interview/voice/transcribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ audio, mimeType: blob.type || 'audio/webm' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed');
      return String(data.text || '').trim();
    },

    conductorOpening: async (ctx: ConductorContext) => {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/interview/voice/turn`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...ctx, isOpening: true, turns: [], userTranscript: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Interviewer unavailable');
      return {
        speak: data.speak as string,
        advance: Boolean(data.advance),
        answerSummary: String(data.answerSummary || ''),
      };
    },

    conductorReply: async (ctx: ConductorContext, userTranscript: string, turns: Turn[]) => {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/interview/voice/turn`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...ctx, isOpening: false, turns, userTranscript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Interviewer unavailable');
      return {
        speak: data.speak as string,
        advance: Boolean(data.advance),
        answerSummary: String(data.answerSummary || ''),
      };
    },
  };
}
