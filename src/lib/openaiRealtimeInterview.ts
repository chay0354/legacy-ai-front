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
  onAdvance: (answerSummary: string, callId: string, questionIndex: number) => Promise<void>;
  onError: (message: string) => void;
};

export type RealtimeVoiceInterview = {
  connect: (ctx: ConductorContext) => Promise<void>;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
  updateInstructions: (instructions: string) => void;
  /** Optionally apply new topic instructions before returning the tool result (avoids race). */
  completeFunctionCall: (callId: string, output: unknown, options?: { instructions?: string; continueResponse?: boolean; nextQuestionIndex?: number }) => void;
  /** Move to the next topic without tearing down the Realtime session (skip). */
  transitionToTopic: (instructions: string, questionIndex: number) => void;
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
  /** User tapped Pause — keep mic off regardless of assistant state. */
  let userPaused = false;
  /** Interviewer is producing a response; mic stays off so ambient noise cannot barge in. */
  let assistantSpeaking = false;
  let unmuteTimer: ReturnType<typeof setTimeout> | null = null;
  /** OpenAI rejects overlapping response.create — queue until the active response finishes. */
  let activeResponseId: string | null = null;
  let pendingResponseCreate = false;
  let conductingQuestionIndex = 0;
  let topicEpoch = 0;
  const responseTopicEpoch = new Map<string, number>();

  const completeFunctionCallSilent = (callId: string, output: unknown) => {
    sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(output),
      },
    });
  };

  const isActiveConnect = (generation: number) =>
    generation === connectGeneration && pc !== null;

  const sendEvent = (event: object) => {
    if (dc?.readyState === 'open') dc.send(JSON.stringify(event));
  };

  const flushPendingResponseCreate = () => {
    if (!pendingResponseCreate || activeResponseId) return;
    pendingResponseCreate = false;
    sendEvent({ type: 'response.create' });
  };

  const requestResponseCreate = () => {
    if (activeResponseId) {
      pendingResponseCreate = true;
      return;
    }
    pendingResponseCreate = false;
    sendEvent({ type: 'response.create' });
  };

  const markResponseFinished = (responseId?: string, skipFlush = false) => {
    if (responseId && activeResponseId && responseId !== activeResponseId) return;
    activeResponseId = null;
    if (!skipFlush) flushPendingResponseCreate();
  };

  const syncMicEnabled = () => {
    const enabled = !userPaused && !assistantSpeaking;
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  };

  const setAssistantSpeaking = (speaking: boolean) => {
    if (unmuteTimer) {
      clearTimeout(unmuteTimer);
      unmuteTimer = null;
    }
    if (speaking) {
      assistantSpeaking = true;
      // Drop any ambient audio already buffered before the interviewer started.
      sendEvent({ type: 'input_audio_buffer.clear' });
      syncMicEnabled();
      return;
    }
    // Brief hold so trailing playback / echo does not immediately re-trigger VAD.
    unmuteTimer = setTimeout(() => {
      unmuteTimer = null;
      assistantSpeaking = false;
      syncMicEnabled();
    }, 350);
  };

  const cleanup = () => {
    connectGeneration += 1;
    connected = false;
    userPaused = false;
    assistantSpeaking = false;
    activeResponseId = null;
    pendingResponseCreate = false;
    conductingQuestionIndex = 0;
    topicEpoch = 0;
    responseTopicEpoch.clear();
    if (unmuteTimer) {
      clearTimeout(unmuteTimer);
      unmuteTimer = null;
    }
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

    // Mute while the interviewer speaks so room noise cannot interrupt / restart them.
    if (type === 'response.created') {
      const response = event.response as { id?: string } | undefined;
      if (response?.id) {
        activeResponseId = response.id;
        responseTopicEpoch.set(response.id, topicEpoch);
      }
      setAssistantSpeaking(true);
    }
    if (type === 'output_audio_buffer.started') {
      setAssistantSpeaking(true);
    }
    if (type === 'output_audio_buffer.stopped') {
      setAssistantSpeaking(false);
    }

    if (type === 'response.output_audio_transcript.done' && typeof event.transcript === 'string') {
      handlers.onLiveLine(event.transcript, 'assistant');
    }
    if (type === 'response.output_text.done' && typeof event.text === 'string') {
      handlers.onLiveLine(event.text, 'assistant');
    }
    if (type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
      handlers.onLiveLine(event.transcript, 'user');
    }

    if (type === 'response.done' || type === 'response.cancelled' || type === 'response.failed') {
      setAssistantSpeaking(false);
      const response = event.response as {
        id?: string;
        output?: Array<{ type: string; name?: string; call_id?: string; arguments?: string }>;
      } | undefined;
      const advanceCall = type === 'response.done'
        ? response?.output?.find(
            (item) => item.type === 'function_call' && item.name === 'complete_anchor_question' && item.call_id,
          )
        : undefined;
      markResponseFinished(response?.id, Boolean(advanceCall));

      if (advanceCall?.call_id) {
        const responseId = response?.id;
        const epoch = responseId ? responseTopicEpoch.get(responseId) : undefined;
        if (responseId) responseTopicEpoch.delete(responseId);
        let summary = '';
        try {
          const args = JSON.parse(advanceCall.arguments || '{}') as { answer_summary?: string };
          summary = String(args.answer_summary || '');
        } catch { /* ignore */ }
        if (epoch !== topicEpoch) {
          completeFunctionCallSilent(advanceCall.call_id, { ok: true, message: 'Already moved on.' });
        } else {
          void handlers.onAdvance(summary, advanceCall.call_id, conductingQuestionIndex);
        }
      }
    }

    if (type === 'error') {
      const err = event.error as { message?: string; code?: string } | undefined;
      const message = err?.message || 'Realtime error';
      if (/active response in progress/i.test(message)) {
        pendingResponseCreate = true;
        return;
      }
      handlers.onError(message);
    }
  };

  return {
    async connect(ctx) {
      const generation = connectGeneration + 1;
      connectGeneration = generation;
      connected = false;
      userPaused = false;
      assistantSpeaking = false;
      activeResponseId = null;
      pendingResponseCreate = false;
      conductingQuestionIndex = ctx.questionIndex;
      topicEpoch = 0;
      responseTopicEpoch.clear();
      if (unmuteTimer) {
        clearTimeout(unmuteTimer);
        unmuteTimer = null;
      }

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
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!isActiveConnect(generation)) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStream = stream;
      userPaused = false;
      assistantSpeaking = false;
      syncMicEnabled();
      for (const track of localStream.getTracks()) {
        pc!.addTrack(track, localStream);
      }

      dc = pc.createDataChannel('oai-events');
      dc.onmessage = (e) => handleServerEvent(String(e.data));
      dc.onopen = () => {
        if (!isActiveConnect(generation) || connected) return;
        connected = true;
        handlers.onConnected();
        requestResponseCreate();
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
      userPaused = true;
      syncMicEnabled();
      if (audioEl) audioEl.pause();
    },

    resume() {
      userPaused = false;
      syncMicEnabled();
      if (audioEl) void audioEl.play().catch(() => {});
    },

    updateInstructions(instructions) {
      sendEvent({
        type: 'session.update',
        session: { type: 'realtime', instructions },
      });
    },

    completeFunctionCall(callId, output, options) {
      if (options?.nextQuestionIndex != null) {
        topicEpoch += 1;
        conductingQuestionIndex = options.nextQuestionIndex;
      }
      if (options?.instructions) {
        sendEvent({
          type: 'session.update',
          session: { type: 'realtime', instructions: options.instructions },
        });
      }
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(output),
        },
      });
      if (options?.continueResponse !== false) {
        requestResponseCreate();
      }
    },

    transitionToTopic(instructions, questionIndex) {
      topicEpoch += 1;
      conductingQuestionIndex = questionIndex;
      if (activeResponseId) {
        sendEvent({ type: 'response.cancel' });
        activeResponseId = null;
      }
      sendEvent({
        type: 'session.update',
        session: { type: 'realtime', instructions },
      });
      pendingResponseCreate = true;
      flushPendingResponseCreate();
    },
  };
}

/** @deprecated Legacy chunked pipeline — use createOpenAiRealtimeInterview */
export function createAiVoiceInterview() {
  throw new Error('Use createOpenAiRealtimeInterview');
}
