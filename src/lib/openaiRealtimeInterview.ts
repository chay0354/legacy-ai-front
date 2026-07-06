import type { ConductorContext } from '../components/InterviewSession';

import { apiUrl } from './apiUrl';
import { authHeaders, clearAuthTokenCache } from './api';

async function fetchWithAuth(path: string, options: RequestInit = {}, retried = false): Promise<Response> {
  const headers = await authHeaders(retried);
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
  });
  if (res.status === 401 && !retried) {
    clearAuthTokenCache();
    return fetchWithAuth(path, options, true);
  }
  return res;
}
export function unlockAudioPlayback() {
  try {
    const ctx = new AudioContext();
    void ctx.resume().then(() => ctx.close());
  } catch { /* ignore */ }
}

export type RealtimeHandlers = {
  onLiveLine: (text: string, role: 'user' | 'assistant') => void;
  onConnected: () => void;
  onAdvance: (answerSummary: string, callId: string) => Promise<void>;
  onError: (message: string) => void;
};

export type RealtimeVoiceInterview = {
  connect: (ctx: ConductorContext) => Promise<void>;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
  updateInstructions: (instructions: string) => void;
  completeFunctionCall: (callId: string, output: unknown) => void;
};

export async function checkAiVoiceAvailable(): Promise<boolean> {
  try {
    const res = await fetchWithAuth('/api/interview/voice/status');
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.realtime || data.available);
  } catch {
    return false;
  }
}
async function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs = 8000) {
  if (pc.iceGatheringState === 'complete') return;

  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onStateChange);
      pc.onicecandidate = null;
      resolve();
    };

    const timer = setTimeout(done, timeoutMs);

    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };

    pc.addEventListener('icegatheringstatechange', onStateChange);
    pc.onicecandidate = (event) => {
      if (!event.candidate) done();
    };
    onStateChange();
  });
}

export async function fetchRealtimeInstructions(ctx: ConductorContext): Promise<string> {
  const res = await fetchWithAuth('/api/interview/voice/realtime/instructions', {
    method: 'POST',
    body: JSON.stringify(ctx),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load instructions');
  return data.instructions as string;
}
export function createOpenAiRealtimeInterview(handlers: RealtimeHandlers): RealtimeVoiceInterview {
  let pc: RTCPeerConnection | null = null;
  let dc: RTCDataChannel | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let localStream: MediaStream | null = null;
  let connected = false;
  let connectGeneration = 0;

  const isActiveConnect = (generation: number) =>
    generation === connectGeneration && pc !== null;

  const sendEvent = (event: object) => {
    if (dc?.readyState === 'open') dc.send(JSON.stringify(event));
  };

  const cleanup = () => {
    connectGeneration += 1;
    connected = false;
    dc?.close();
    dc = null;
    pc?.close();
    pc = null;
    localStream?.getTracks().forEach((t) => t.stop());
    localStream = null;
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      audioEl = null;
    }
  };

  const handleServerEvent = (raw: string) => {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = String(event.type || '');

    if (type === 'response.output_audio_transcript.done' && typeof event.transcript === 'string') {
      handlers.onLiveLine(event.transcript, 'assistant');
    }
    if (type === 'response.output_text.done' && typeof event.text === 'string') {
      handlers.onLiveLine(event.text, 'assistant');
    }
    if (type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
      handlers.onLiveLine(event.transcript, 'user');
    }

    if (type === 'response.done') {
      const response = event.response as { output?: Array<{ type: string; name?: string; call_id?: string; arguments?: string }> } | undefined;
      for (const item of response?.output || []) {
        if (item.type === 'function_call' && item.name === 'complete_anchor_question' && item.call_id) {
          let summary = '';
          try {
            const args = JSON.parse(item.arguments || '{}') as { answer_summary?: string };
            summary = String(args.answer_summary || '');
          } catch { /* ignore */ }
          void handlers.onAdvance(summary, item.call_id);
        }
      }
    }

    if (type === 'error') {
      const err = event.error as { message?: string } | undefined;
      handlers.onError(err?.message || 'Realtime error');
    }
  };

  return {
    async connect(ctx) {
      const generation = connectGeneration + 1;
      connectGeneration = generation;
      connected = false;

      dc?.close();
      dc = null;
      pc?.close();
      pc = null;
      localStream?.getTracks().forEach((t) => t.stop());
      localStream = null;
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
        audioEl = null;
      }

      unlockAudioPlayback();

      const nextPc = new RTCPeerConnection();
      if (generation !== connectGeneration) {
        nextPc.close();
        return;
      }
      pc = nextPc;

      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      document.body.appendChild(audioEl);

      pc.ontrack = (e) => {
        if (audioEl && e.streams[0]) audioEl.srcObject = e.streams[0];
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!isActiveConnect(generation)) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStream = stream;
      for (const track of localStream.getTracks()) {
        pc!.addTrack(track, localStream);
      }

      dc = pc.createDataChannel('oai-events');
      dc.onmessage = (e) => handleServerEvent(String(e.data));
      dc.onopen = () => {
        if (!isActiveConnect(generation) || connected) return;
        connected = true;
        handlers.onConnected();
        sendEvent({ type: 'response.create' });
      };

      const offer = await pc.createOffer();
      if (!isActiveConnect(generation)) return;
      await pc.setLocalDescription(offer);
      if (!isActiveConnect(generation)) return;
      await waitForIceGatheringComplete(pc);
      if (!isActiveConnect(generation)) return;

      const sdp = pc.localDescription?.sdp;
      if (!sdp || sdp.trim().length < 100) {
        throw new Error('Incomplete SDP offer — check microphone permissions and try again');
      }

      const tokenRes = await fetchWithAuth('/api/interview/voice/realtime/token', {
        method: 'POST',
        body: JSON.stringify(ctx),
      });
      if (!isActiveConnect(generation)) return;

      if (!tokenRes.ok) {
        const data = await tokenRes.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Realtime token failed ${tokenRes.status}`);
      }
      const tokenPayload = (await tokenRes.json()) as { token?: string; value?: string };
      const token = tokenPayload.token || tokenPayload.value;
      if (!token) throw new Error('Realtime token missing from server response');
      if (!isActiveConnect(generation)) return;

      // Ephemeral flow: session config is in the token; body is raw SDP only (official GA docs).
      const res = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
        body: sdp,
      });
      if (!isActiveConnect(generation)) return;

      if (!res.ok) {
        const errText = await res.text();
        let message = errText;
        try {
          const parsed = JSON.parse(errText) as {
            error?: string | { message?: string; code?: string };
          };
          if (typeof parsed.error === 'string') {
            message = parsed.error;
          } else if (parsed.error?.message) {
            message = parsed.error.code
              ? `${parsed.error.message} (${parsed.error.code})`
              : parsed.error.message;
          }
        } catch { /* use raw text */ }
        throw new Error(message || `Realtime session failed ${res.status}`);
      }

      const answerSdp = await res.text();
      if (!isActiveConnect(generation)) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    },

    disconnect() {
      cleanup();
    },

    pause() {
      localStream?.getAudioTracks().forEach((t) => { t.enabled = false; });
      if (audioEl) audioEl.pause();
    },

    resume() {
      localStream?.getAudioTracks().forEach((t) => { t.enabled = true; });
      if (audioEl) void audioEl.play().catch(() => {});
    },

    updateInstructions(instructions) {
      sendEvent({
        type: 'session.update',
        session: { type: 'realtime', instructions },
      });
    },

    completeFunctionCall(callId, output) {
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(output),
        },
      });
      sendEvent({ type: 'response.create' });
    },
  };
}

/** @deprecated Legacy chunked pipeline — use createOpenAiRealtimeInterview */
export function createAiVoiceInterview() {
  throw new Error('Use createOpenAiRealtimeInterview');
}
