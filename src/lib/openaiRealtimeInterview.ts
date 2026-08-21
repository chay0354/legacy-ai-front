import type { ConductorContext } from '../components/InterviewSession';

import { apiUrl } from './apiUrl';
import { authHeaders, clearAuthTokenCache } from './api';
import { playMedia } from './playMedia';

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

export type TranscriptMeta = {
  /** true while streaming partial text; false for final utterance text */
  partial?: boolean;
};

export type RealtimeHandlers = {
  onLiveLine: (text: string, role: 'user' | 'assistant', meta?: TranscriptMeta) => void;
  onConnected: () => void;
  onAdvance: (answerSummary: string, callId: string, questionIndex: number) => Promise<void>;
  /** Model recorded a "don't talk about X" exclusion via tool call. */
  onTopicExclusion?: (topic: string) => void;
  onError: (message: string) => void;
};

export type ResumeBriefing = {
  topicNum: number;
  totalTopics: number;
  topicPrompt: string;
  /** Last thing the speaker said, if any — helps re-orient after pause. */
  lastUserNote?: string;
};

export type RealtimeVoiceInterview = {
  connect: (ctx: ConductorContext) => Promise<void>;
  disconnect: () => void;
  pause: () => void;
  resume: (briefing?: ResumeBriefing) => void;
  /** Soft prompt so the interviewer continues if the session went quiet. */
  nudge: (reason?: 'idle' | 'manual' | 'escalate') => void;
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
/** If a response never finishes, clear the lock so the interview can continue. */
const STUCK_RESPONSE_MS = 45000;
/** Dead air after the last turn — auto-recover before the user has to ask "are you there?" */
const IDLE_NUDGE_MS = 12000;
/** After the user spoke, expect the interviewer sooner than a general idle. */
const POST_USER_REPLY_MS = 8000;
/** If an idle nudge produced no speech, escalate sooner. */
const NUDGE_NO_SPEECH_MS = 7000;
/** Tool-call advance stuck — don't block silence recovery forever. */
const AWAITING_FUNCTION_MS = 15000;
const MAX_IDLE_NUDGES = 5;
const WATCHDOG_TICK_MS = 2500;
/** Hold mic muted briefly after AI audio ends so echo doesn't steal the turn. */
const UNMUTE_HOLD_MS = 600;
/** Match backend default — keep pause/resume VAD aligned with session config. */
const VAD_THRESHOLD = 0.72;
const VAD_PREFIX_PADDING_MS = 300;
const VAD_SILENCE_MS = 2000;
const TRANSCRIPTION_MODEL = 'gpt-4o-transcribe';

function normalizeClientLanguage(code?: string): string {
  const base = String(code || 'en').trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2}$/.test(base) ? base : 'en';
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
  /** Interviewer audio is playing; mic stays off so ambient noise cannot barge in. */
  let assistantSpeaking = false;
  /** Server VAD thinks the user is mid-utterance — never start/force a reply over them. */
  let userIsSpeaking = false;
  /** True only while output_audio_buffer is actively playing (not merely response.created). */
  let outputAudioActive = false;
  let unmuteTimer: ReturnType<typeof setTimeout> | null = null;
  let afterUserSpeechFlushTimer: ReturnType<typeof setTimeout> | null = null;
  /** OpenAI rejects overlapping response.create — queue until the active response finishes. */
  let activeResponseId: string | null = null;
  let activeResponseStartedAt = 0;
  let pendingResponseCreate = false;
  let conductingQuestionIndex = 0;
  let totalTopicsKnown = 1;
  let currentTopicPrompt = '';
  let topicEpoch = 0;
  const responseTopicEpoch = new Map<string, number>();
  let lastActivityAt = Date.now();
  let lastAssistantActivityAt = 0;
  let lastUserActivityAt = 0;
  let idleNudgeCount = 0;
  let lastIdleNudgeAt = 0;
  let awaitingFunctionSince = 0;
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  /** Function-call output in flight — don't idle-nudge until it completes. */
  let awaitingFunctionOutput = false;
  /** Avoid double-emitting the same assistant turn from transcript.done + response.done. */
  let sawAssistantTranscriptForResponse = false;
  /** Live remote MediaStream from WebRTC (keep attached; mute instead of detaching). */
  let remoteStream: MediaStream | null = null;
  /**
   * After resume, stay muted until the *next* output_audio_buffer.started.
   * Prevents a leftover jitter-buffer blip + NetEQ "speed-up" of old packets.
   */
  let awaitFreshAudioAfterResume = false;
  let resumeClearTimer: ReturnType<typeof setTimeout> | null = null;
  /** While paused, cancel any response that slips through after clear. */
  let pauseEnforceTimer: ReturnType<typeof setInterval> | null = null;
  /** Locked session language for ASR + interviewer speech (default English). */
  let sessionLanguage = 'en';

  const touchActivity = (role?: 'user' | 'assistant') => {
    lastActivityAt = Date.now();
    if (role === 'user') {
      lastUserActivityAt = lastActivityAt;
      idleNudgeCount = 0;
      lastIdleNudgeAt = 0;
    }
    if (role === 'assistant') {
      lastAssistantActivityAt = lastActivityAt;
      idleNudgeCount = 0;
      lastIdleNudgeAt = 0;
    }
  };

  const setAwaitingFunctionOutput = (waiting: boolean) => {
    awaitingFunctionOutput = waiting;
    awaitingFunctionSince = waiting ? Date.now() : 0;
  };

  const isActiveConnect = (generation: number) =>
    generation === connectGeneration && pc !== null;

  const sendEvent = (event: object) => {
    if (dc?.readyState === 'open') dc.send(JSON.stringify(event));
  };

  const flushPendingResponseCreate = () => {
    if (userPaused || !pendingResponseCreate || activeResponseId || userIsSpeaking) return;
    pendingResponseCreate = false;
    touchActivity();
    sendEvent({ type: 'response.create' });
  };

  const requestResponseCreate = () => {
    // Drop while paused — do not queue a response that would fire on resume unexpectedly.
    if (userPaused) return;
    // Never talk over them — queue until VAD marks end of their utterance.
    if (userIsSpeaking) {
      pendingResponseCreate = true;
      return;
    }
    if (activeResponseId) {
      pendingResponseCreate = true;
      return;
    }
    pendingResponseCreate = false;
    touchActivity();
    sendEvent({ type: 'response.create' });
  };

  /** User kept talking before AI audio started — cancel the cut-off turn. */
  const yieldToUserSpeech = () => {
    if (userPaused || !activeResponseId || outputAudioActive) return;
    console.info('[realtime] yield to user — cancel response that would talk over them');
    sendEvent({ type: 'response.cancel', response_id: activeResponseId });
    sendEvent({ type: 'output_audio_buffer.clear' });
    activeResponseId = null;
    activeResponseStartedAt = 0;
    pendingResponseCreate = false;
    clearAssistantSpeaking();
  };

  const markResponseFinished = (responseId?: string, skipFlush = false) => {
    if (responseId && activeResponseId && responseId !== activeResponseId) return;
    activeResponseId = null;
    activeResponseStartedAt = 0;
    if (!skipFlush) flushPendingResponseCreate();
  };

  /**
   * OpenAI WebRTC pause/interrupt pattern:
   * - Mute locally (keep the element attached + playing) so the jitter buffer drains
   *   in real time. Detaching / disabling tracks makes NetEQ accelerate on resume.
   * - Then response.cancel + output_audio_buffer.clear on the data channel.
   * @see https://developers.openai.com/api/docs/guides/realtime-conversations
   */
  const setPlaybackAudible = (audible: boolean) => {
    if (!audioEl) return;
    audioEl.muted = !audible;
    audioEl.volume = audible ? 1 : 0;
    if (audible) void playMedia(audioEl);
  };

  const ensureRemoteStream = (): MediaStream | null => {
    if (remoteStream) return remoteStream;
    const tracks = pc?.getReceivers()
      .map((r) => r.track)
      .filter((t): t is MediaStreamTrack => Boolean(t && t.kind === 'audio' && t.readyState !== 'ended')) ?? [];
    if (!tracks.length) return null;
    remoteStream = new MediaStream(tracks);
    return remoteStream;
  };

  /** Keep stream attached and draining; only silence the speaker. */
  const muteLocalPlayback = () => {
    const stream = ensureRemoteStream();
    if (stream && audioEl && audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }
    // Keep tracks enabled so RTP is consumed at 1x (avoids backlog → chipmunk speech).
    stream?.getAudioTracks().forEach((t) => { t.enabled = true; });
    pc?.getReceivers().forEach((receiver) => {
      if (receiver.track?.kind === 'audio') receiver.track.enabled = true;
    });
    if (audioEl) {
      audioEl.muted = true;
      audioEl.volume = 0;
      void playMedia(audioEl);
    }
  };

  /** Fresh <audio> dumps any HTML-decoded leftovers that mute alone can't clear. */
  const rebindFreshAudioElement = (audible: boolean) => {
    const stream = ensureRemoteStream();
    if (audioEl) {
      try { audioEl.pause(); } catch { /* ignore */ }
      audioEl.srcObject = null;
      audioEl.remove();
      audioEl = null;
    }
    audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', 'true');
    document.body.appendChild(audioEl);
    if (stream) {
      stream.getAudioTracks().forEach((t) => { t.enabled = true; });
      audioEl.srcObject = stream;
    }
    setPlaybackAudible(audible);
  };

  /** Cut server-side speech (official WebRTC interrupt): cancel, then clear output buffer. */
  const hardStopInterviewerAudio = () => {
    muteLocalPlayback();
    if (activeResponseId) {
      sendEvent({ type: 'response.cancel', response_id: activeResponseId });
    }
    sendEvent({ type: 'output_audio_buffer.clear' });
    sendEvent({ type: 'input_audio_buffer.clear' });
    activeResponseId = null;
    activeResponseStartedAt = 0;
    pendingResponseCreate = false;
    outputAudioActive = false;
    clearAssistantSpeaking();
  };

  const stopPauseEnforce = () => {
    if (pauseEnforceTimer) {
      clearInterval(pauseEnforceTimer);
      pauseEnforceTimer = null;
    }
  };

  const startPauseEnforce = () => {
    stopPauseEnforce();
    pauseEnforceTimer = setInterval(() => {
      if (!userPaused) {
        stopPauseEnforce();
        return;
      }
      muteLocalPlayback();
      if (activeResponseId) {
        sendEvent({ type: 'response.cancel', response_id: activeResponseId });
        sendEvent({ type: 'output_audio_buffer.clear' });
        activeResponseId = null;
        activeResponseStartedAt = 0;
        clearAssistantSpeaking();
      }
    }, 400);
  };

  /** While paused, stop the server from auto-starting new interviewer turns. */
  const setServerListening = (enabled: boolean) => {
    // Keep VAD config but disable auto response.create while paused.
    // Always re-assert transcription so pause/resume updates don't drop user transcripts.
    sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        audio: {
          input: {
            turn_detection: {
              type: 'server_vad',
              threshold: VAD_THRESHOLD,
              prefix_padding_ms: VAD_PREFIX_PADDING_MS,
              silence_duration_ms: VAD_SILENCE_MS,
              create_response: enabled,
              interrupt_response: false,
            },
            transcription: {
              model: TRANSCRIPTION_MODEL,
              language: sessionLanguage,
            },
          },
        },
      },
    });
  };

  const syncMicEnabled = () => {
    const enabled = !userPaused && !assistantSpeaking;
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  };

  const clearAssistantSpeaking = () => {
    if (unmuteTimer) {
      clearTimeout(unmuteTimer);
      unmuteTimer = null;
    }
    assistantSpeaking = false;
    syncMicEnabled();
  };

  const completeFunctionCallSilent = (callId: string, output: unknown, continueResponse = true) => {
    setAwaitingFunctionOutput(false);
    sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(output),
      },
    });
    if (continueResponse) requestResponseCreate();
  };

  const forceClearSpeechLocks = (reason: string) => {
    console.warn('[realtime] force-clear speech locks:', reason);
    if (activeResponseId) {
      sendEvent({ type: 'response.cancel', response_id: activeResponseId });
    }
    sendEvent({ type: 'output_audio_buffer.clear' });
    activeResponseId = null;
    activeResponseStartedAt = 0;
    pendingResponseCreate = false;
    outputAudioActive = false;
    setAwaitingFunctionOutput(false);
    clearAssistantSpeaking();
  };

  const nudgeInterview = (reason: 'idle' | 'manual' | 'escalate' = 'idle') => {
    if (!connected || userPaused) return;
    // Never nudge while they are mid-utterance — that is classic talk-over.
    if (userIsSpeaking) {
      pendingResponseCreate = true;
      return;
    }

    // Stuck tool-call / response must not block silence recovery.
    if (awaitingFunctionOutput && awaitingFunctionSince && Date.now() - awaitingFunctionSince > AWAITING_FUNCTION_MS) {
      forceClearSpeechLocks('awaitingFunctionOutput timeout');
    } else if (awaitingFunctionOutput && reason !== 'escalate' && reason !== 'manual') {
      return;
    }

    if (activeResponseId) {
      const age = Date.now() - activeResponseStartedAt;
      if (age > STUCK_RESPONSE_MS || reason === 'escalate' || reason === 'manual') {
        forceClearSpeechLocks('stuck activeResponse before nudge');
      } else {
        return;
      }
    }

    if (assistantSpeaking) clearAssistantSpeaking();

    idleNudgeCount += 1;
    lastIdleNudgeAt = Date.now();
    lastActivityAt = lastIdleNudgeAt;

    const topicIdea = (currentTopicPrompt || 'the current topic').trim();
    const topicNum = conductingQuestionIndex + 1;
    let instructions: string;
    if (reason === 'manual') {
      instructions =
        `The listener asked if you are still there. Briefly reassure them, then continue topic ${topicNum} of ${totalTopicsKnown} in fresh warm words (idea: "${topicIdea}"). Do not restart the welcome. Do not advance topics.`;
    } else if (reason === 'escalate' || idleNudgeCount >= 3) {
      instructions =
        `You went silent mid-interview. Immediately continue: warmly re-ask the current topic (${topicNum} of ${totalTopicsKnown}) in plain spoken words (idea: "${topicIdea}"), then STOP and wait. Do not invent names, places, dates, or any facts they did not say. Do not restart the welcome. Do not advance topics. Do not apologize at length.`;
    } else {
      instructions =
        `The conversation went quiet. In one short warm sentence check in, then re-ask or continue the current topic (${topicNum} of ${totalTopicsKnown}) in fresh words (idea: "${topicIdea}"). Then STOP and wait. Do not invent names, places, dates, or any facts they did not say. Do not restart the welcome, and do not advance topics.`;
    }

    const languageLock =
      ` Reply only in session language "${sessionLanguage}". Do not switch to Hebrew, Arabic, German, or any other language.`;
    console.info('[realtime] silence recovery nudge', { reason, idleNudgeCount, topicNum, sessionLanguage });
    sendEvent({
      type: 'response.create',
      response: { instructions: `${instructions}${languageLock}` },
    });
  };

  const runWatchdog = () => {
    if (!connected || userPaused) return;
    const now = Date.now();

    // Mic can get stuck muted if a speaking-end event is dropped.
    if (assistantSpeaking && activeResponseStartedAt && now - activeResponseStartedAt > STUCK_RESPONSE_MS) {
      forceClearSpeechLocks('assistantSpeaking stuck');
    }

    if (activeResponseId && activeResponseStartedAt && now - activeResponseStartedAt > STUCK_RESPONSE_MS) {
      forceClearSpeechLocks('activeResponse watchdog');
      pendingResponseCreate = true;
      flushPendingResponseCreate();
      return;
    }

    if (awaitingFunctionOutput && awaitingFunctionSince && now - awaitingFunctionSince > AWAITING_FUNCTION_MS) {
      forceClearSpeechLocks('awaitingFunctionOutput watchdog');
    }

    if (awaitingFunctionOutput || activeResponseId || assistantSpeaking || userIsSpeaking) return;

    // Nudge only after the interviewer has spoken at least once.
    if (!lastAssistantActivityAt) return;

    // If we already nudged but she never spoke, escalate quickly.
    if (lastIdleNudgeAt && now - lastIdleNudgeAt >= NUDGE_NO_SPEECH_MS) {
      if (lastAssistantActivityAt < lastIdleNudgeAt) {
        console.info('[realtime] idle nudge produced no speech — escalating');
        nudgeInterview('escalate');
        return;
      }
    }

    const lastTurnAt = Math.max(lastAssistantActivityAt, lastUserActivityAt, lastActivityAt);
    const quietFor = now - lastTurnAt;
    // User finished speaking and got no reply — recover faster than general idle.
    const userWaitingForReply =
      lastUserActivityAt > 0 &&
      lastUserActivityAt >= lastAssistantActivityAt &&
      now - lastUserActivityAt >= POST_USER_REPLY_MS;

    // After several nudges, keep recovering slowly instead of dying silent forever.
    const minGap = idleNudgeCount >= MAX_IDLE_NUDGES ? 20000 : NUDGE_NO_SPEECH_MS;
    if (lastIdleNudgeAt && now - lastIdleNudgeAt < minGap) return;

    if (userWaitingForReply || quietFor >= IDLE_NUDGE_MS) {
      console.info('[realtime] silence recovery after', quietFor, 'ms quiet', { userWaitingForReply, idleNudgeCount });
      nudgeInterview(idleNudgeCount >= 2 ? 'escalate' : 'idle');
    }
  };

  const startWatchdog = () => {
    if (watchdogTimer) clearInterval(watchdogTimer);
    watchdogTimer = setInterval(runWatchdog, WATCHDOG_TICK_MS);
  };

  const stopWatchdog = () => {
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  };

  const setAssistantSpeaking = (speaking: boolean) => {
    // While paused we keep playback/mic fully stopped; don't re-enter "assistant speaking"
    // or resume will leave the mic muted forever.
    if (userPaused) {
      if (!speaking) clearAssistantSpeaking();
      return;
    }
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
    }, UNMUTE_HOLD_MS);
  };

  const cleanup = () => {
    connectGeneration += 1;
    connected = false;
    userPaused = false;
    assistantSpeaking = false;
    userIsSpeaking = false;
    outputAudioActive = false;
    activeResponseId = null;
    activeResponseStartedAt = 0;
    pendingResponseCreate = false;
    setAwaitingFunctionOutput(false);
    if (afterUserSpeechFlushTimer) {
      clearTimeout(afterUserSpeechFlushTimer);
      afterUserSpeechFlushTimer = null;
    }
    conductingQuestionIndex = 0;
    totalTopicsKnown = 1;
    currentTopicPrompt = '';
    topicEpoch = 0;
    responseTopicEpoch.clear();
    idleNudgeCount = 0;
    lastIdleNudgeAt = 0;
    lastAssistantActivityAt = 0;
    lastUserActivityAt = 0;
    remoteStream = null;
    awaitFreshAudioAfterResume = false;
    if (resumeClearTimer) {
      clearTimeout(resumeClearTimer);
      resumeClearTimer = null;
    }
    stopPauseEnforce();
    stopWatchdog();
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

    // Track response id early, but do NOT mute the mic yet — muting on response.created
    // dropped mid-thought speech before AI audio started (felt like being talked over).
    if (type === 'response.created') {
      const response = event.response as { id?: string } | undefined;
      if (response?.id) {
        activeResponseId = response.id;
        activeResponseStartedAt = Date.now();
        responseTopicEpoch.set(response.id, topicEpoch);
      }
      sawAssistantTranscriptForResponse = false;
      // Pause must be absolute — kill anything that still starts while paused.
      if (userPaused) {
        hardStopInterviewerAudio();
        return;
      }
      // If they are still speaking, cancel this turn immediately.
      if (userIsSpeaking) {
        yieldToUserSpeech();
        return;
      }
      touchActivity('assistant');
    }
    if (type === 'output_audio_buffer.started') {
      if (userPaused) {
        hardStopInterviewerAudio();
        return;
      }
      // User kept talking — yield before we lock the mic / play over them.
      if (userIsSpeaking) {
        yieldToUserSpeech();
        return;
      }
      // Unmute only for fresh post-resume audio — skips leftover buffer blips.
      if (awaitFreshAudioAfterResume) {
        awaitFreshAudioAfterResume = false;
        setPlaybackAudible(true);
      }
      outputAudioActive = true;
      touchActivity('assistant');
      setAssistantSpeaking(true);
    }
    if (type === 'output_audio_buffer.stopped' || type === 'output_audio_buffer.cleared') {
      outputAudioActive = false;
      touchActivity('assistant');
      setAssistantSpeaking(false);
      if (userPaused || awaitFreshAudioAfterResume) muteLocalPlayback();
    }

    // Assistant speech → on-screen transcript (stream deltas, then finalize).
    if (type === 'response.output_audio_transcript.delta' && typeof event.delta === 'string') {
      if (!userPaused && event.delta) {
        touchActivity('assistant');
        handlers.onLiveLine(event.delta, 'assistant', { partial: true });
      }
    }
    if (type === 'response.output_audio_transcript.done' && typeof event.transcript === 'string') {
      if (!userPaused && event.transcript.trim()) {
        sawAssistantTranscriptForResponse = true;
        touchActivity('assistant');
        handlers.onLiveLine(event.transcript, 'assistant', { partial: false });
      }
    }
    if (type === 'response.output_text.delta' && typeof event.delta === 'string') {
      if (!userPaused && event.delta) {
        touchActivity('assistant');
        handlers.onLiveLine(event.delta, 'assistant', { partial: true });
      }
    }
    if (type === 'response.output_text.done' && typeof event.text === 'string') {
      if (!userPaused && event.text.trim()) {
        sawAssistantTranscriptForResponse = true;
        touchActivity('assistant');
        handlers.onLiveLine(event.text, 'assistant', { partial: false });
      }
    }

    // VAD start/end — drive turn-taking so we never force a reply over them.
    if (type === 'input_audio_buffer.speech_started') {
      if (!userPaused) {
        userIsSpeaking = true;
        touchActivity('user');
        if (afterUserSpeechFlushTimer) {
          clearTimeout(afterUserSpeechFlushTimer);
          afterUserSpeechFlushTimer = null;
        }
        // Still in the gap before AI audio — cancel so we don't talk over them.
        yieldToUserSpeech();
      }
    }
    if (type === 'input_audio_buffer.speech_stopped') {
      if (!userPaused) {
        userIsSpeaking = false;
        touchActivity('user');
        // Brief settle after end-of-turn before client-forced replies (nudge / tool / skip).
        if (afterUserSpeechFlushTimer) clearTimeout(afterUserSpeechFlushTimer);
        afterUserSpeechFlushTimer = setTimeout(() => {
          afterUserSpeechFlushTimer = null;
          if (!userPaused && !userIsSpeaking) flushPendingResponseCreate();
        }, 350);
      }
    }
    // User speech → on-screen transcript (stream + final).
    if (type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
      if (!userPaused && event.delta) {
        touchActivity('user');
        handlers.onLiveLine(event.delta, 'user', { partial: true });
      }
    }
    if (type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
      if (!userPaused && event.transcript.trim()) {
        touchActivity('user');
        handlers.onLiveLine(event.transcript, 'user', { partial: false });
      }
    }

    if (type === 'response.done' || type === 'response.cancelled' || type === 'response.failed') {
      // Do not unmute from response.done alone — audio may still be draining.
      // Only clear mute here when no output buffer was playing (tool-only / failed turns).
      if (!outputAudioActive) {
        setAssistantSpeaking(false);
      }
      const response = event.response as {
        id?: string;
        status?: string;
        output?: Array<{
          type: string;
          name?: string;
          call_id?: string;
          arguments?: string;
          content?: Array<{ type?: string; transcript?: string; text?: string }>;
        }>;
      } | undefined;
      // Fallback when streaming transcript events were missed.
      if (type === 'response.done' && !userPaused && !sawAssistantTranscriptForResponse) {
        for (const item of response?.output || []) {
          if (item.type !== 'message' || !item.content) continue;
          for (const part of item.content) {
            const spoken = String(part.transcript || part.text || '').trim();
            if (spoken) {
              sawAssistantTranscriptForResponse = true;
              handlers.onLiveLine(spoken, 'assistant', { partial: false });
            }
          }
        }
      }
      const outputItems = type === 'response.done' ? (response?.output || []) : [];
      const exclusionCalls = outputItems.filter(
        (item) => item.type === 'function_call' && item.name === 'record_topic_exclusion' && item.call_id,
      );
      const advanceCall = outputItems.find(
        (item) => item.type === 'function_call' && item.name === 'complete_anchor_question' && item.call_id,
      );

      for (const excl of exclusionCalls) {
        let topic = '';
        try {
          const args = JSON.parse(excl.arguments || '{}') as { topic?: string };
          topic = String(args.topic || '').trim();
        } catch { /* ignore */ }
        if (topic) handlers.onTopicExclusion?.(topic);
        completeFunctionCallSilent(
          excl.call_id!,
          {
            ok: true,
            message: topic
              ? `Recorded exclusion: "${topic}". Do not ask about it again. Acknowledge briefly and continue on a safe subject.`
              : 'Could not parse exclusion — continue without pressing that subject.',
          },
          !advanceCall && !userPaused,
        );
      }

      markResponseFinished(response?.id, Boolean(advanceCall));
      touchActivity();

      const advanceCallId = advanceCall?.call_id;
      if (advanceCallId) {
        const responseId = response?.id;
        const epoch = responseId ? responseTopicEpoch.get(responseId) : undefined;
        if (responseId) responseTopicEpoch.delete(responseId);
        let summary = '';
        try {
          const args = JSON.parse(advanceCall?.arguments || '{}') as { answer_summary?: string };
          summary = String(args.answer_summary || '');
        } catch { /* ignore */ }
        // Don't advance topics or keep talking while the user has paused.
        if (userPaused) {
          completeFunctionCallSilent(advanceCallId, { ok: true, message: 'Paused — wait for resume.' }, false);
        } else if (epoch !== topicEpoch) {
          // Always continue speaking after stale tool calls — silence was a hang source.
          completeFunctionCallSilent(advanceCallId, { ok: true, message: 'Already moved on.' }, true);
        } else {
          setAwaitingFunctionOutput(true);
          void handlers.onAdvance(summary, advanceCallId, conductingQuestionIndex).catch((err) => {
            console.warn('[realtime] onAdvance failed', err);
            completeFunctionCallSilent(
              advanceCallId,
              {
                ok: false,
                continue: true,
                message: 'Could not save that topic just now. Stay on this topic and continue warmly.',
              },
              true,
            );
          });
        }
      } else if (type === 'response.failed' && !userPaused) {
        // Don't leave the interview dead after a failed model turn.
        pendingResponseCreate = true;
        flushPendingResponseCreate();
      }
    }

    if (type === 'error') {
      const err = event.error as { message?: string; code?: string } | undefined;
      const message = err?.message || 'Realtime error';
      // Harmless: we often cancel/clear after the response already ended (pause/resume).
      if (/no active response|cancellation failed|not found|already.?cancel/i.test(message)) {
        return;
      }
      if (/active response in progress/i.test(message)) {
        pendingResponseCreate = true;
        return;
      }
      // Recoverable transport blips — nudge instead of tearing the session down.
      if (/timeout|temporar|network|disconnect/i.test(message) && connected && !userPaused) {
        console.warn('[realtime] recoverable error, nudging', message);
        pendingResponseCreate = true;
        flushPendingResponseCreate();
        return;
      }
      if (userPaused) return;
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
      awaitFreshAudioAfterResume = false;
      remoteStream = null;
      if (resumeClearTimer) {
        clearTimeout(resumeClearTimer);
        resumeClearTimer = null;
      }
      activeResponseId = null;
      activeResponseStartedAt = 0;
      pendingResponseCreate = false;
      setAwaitingFunctionOutput(false);
      conductingQuestionIndex = ctx.questionIndex;
      totalTopicsKnown = ctx.totalQuestions || 1;
      currentTopicPrompt = ctx.anchorQuestion || '';
      sessionLanguage = normalizeClientLanguage(ctx.language);
      topicEpoch = 0;
      responseTopicEpoch.clear();
      idleNudgeCount = 0;
      lastIdleNudgeAt = 0;
      lastActivityAt = Date.now();
      lastAssistantActivityAt = 0;
      lastUserActivityAt = 0;
      stopWatchdog();
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
        if (!e.streams[0]) return;
        remoteStream = e.streams[0];
        // Keep tracks enabled so the jitter buffer drains at 1x even while muted.
        remoteStream.getAudioTracks().forEach((t) => { t.enabled = true; });
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = remoteStream;
        // Stay silent while paused / waiting for a clean resume.
        const audible = !userPaused && !awaitFreshAudioAfterResume;
        setPlaybackAudible(audible);
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
        touchActivity();
        startWatchdog();
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
      awaitFreshAudioAfterResume = false;
      pendingResponseCreate = false;
      setAwaitingFunctionOutput(false);
      if (resumeClearTimer) {
        clearTimeout(resumeClearTimer);
        resumeClearTimer = null;
      }
      // Official WebRTC interrupt: mute locally, cancel response, clear output buffer.
      hardStopInterviewerAudio();
      setServerListening(false);
      syncMicEnabled();
      startPauseEnforce();
    },

    resume(briefing) {
      stopPauseEnforce();
      userPaused = false;
      pendingResponseCreate = false;
      setAwaitingFunctionOutput(false);
      awaitFreshAudioAfterResume = true;
      lastIdleNudgeAt = 0;
      if (briefing) {
        if (Number.isFinite(briefing.topicNum) && briefing.topicNum > 0) {
          conductingQuestionIndex = briefing.topicNum - 1;
        }
        if (Number.isFinite(briefing.totalTopics) && briefing.totalTopics > 0) {
          totalTopicsKnown = briefing.totalTopics;
        }
        if (briefing.topicPrompt?.trim()) currentTopicPrompt = briefing.topicPrompt.trim();
      }

      // Stay muted; clear server buffer; rebuild <audio> so old packets can't blip.
      muteLocalPlayback();
      if (activeResponseId) {
        sendEvent({ type: 'response.cancel', response_id: activeResponseId });
      }
      sendEvent({ type: 'output_audio_buffer.clear' });
      sendEvent({ type: 'input_audio_buffer.clear' });
      activeResponseId = null;
      activeResponseStartedAt = 0;
      clearAssistantSpeaking();
      rebindFreshAudioElement(false);
      syncMicEnabled();
      idleNudgeCount = 0;
      lastIdleNudgeAt = 0;
      touchActivity();

      const topicNum = (briefing?.topicNum && briefing.topicNum > 0)
        ? briefing.topicNum
        : conductingQuestionIndex + 1;
      const total = (briefing?.totalTopics && briefing.totalTopics > 0)
        ? briefing.totalTopics
        : totalTopicsKnown;
      const topicIdea = (briefing?.topicPrompt || currentTopicPrompt || 'the current topic').trim();
      const lastNote = String(briefing?.lastUserNote || '').trim();
      const lastNoteLine = lastNote
        ? `They had started sharing something like: "${lastNote.slice(0, 220)}${lastNote.length > 220 ? '…' : ''}". Invite them to continue from there.`
        : 'If they had been mid-answer, invite them to continue from where they left off; otherwise gently re-pose the current topic in fresh warm words.';

      const speakResumeOrientation = () => {
        if (userPaused) return;
        setServerListening(true);
        // If they already started talking on resume, wait — don't talk over them.
        if (userIsSpeaking) {
          pendingResponseCreate = true;
          return;
        }
        sendEvent({
          type: 'response.create',
          response: {
            instructions:
              `The interview just resumed after a pause. Speak at a calm natural pace in session language "${sessionLanguage}" only (never Hebrew, Arabic, or German). Orient them in 2–3 short warm sentences, then STOP and wait:
1) Welcome them back and say clearly where you are: topic ${topicNum} of ${total}.
2) Remind them what this topic is about, in plain spoken words (idea: "${topicIdea}"). Do NOT read it like a form field.
3) ${lastNoteLine}
Do NOT restart the welcome/intro. Do NOT advance topics. Do NOT call complete_anchor_question. Do NOT invent facts.`,
          },
        });
      };

      // Brief settle so output_audio_buffer.clear + jitter buffer can drain before new speech.
      if (resumeClearTimer) clearTimeout(resumeClearTimer);
      resumeClearTimer = setTimeout(() => {
        resumeClearTimer = null;
        speakResumeOrientation();
      }, 220);
    },

    nudge(reason = 'manual') {
      nudgeInterview(reason);
    },

    updateInstructions(instructions) {
      sendEvent({
        type: 'session.update',
        session: { type: 'realtime', instructions },
      });
    },

    completeFunctionCall(callId, output, options) {
      setAwaitingFunctionOutput(false);
      touchActivity();
      idleNudgeCount = 0;
      lastIdleNudgeAt = 0;
      if (options?.nextQuestionIndex != null) {
        topicEpoch += 1;
        conductingQuestionIndex = options.nextQuestionIndex;
      }
      if (options?.instructions) {
        const m = options.instructions.match(/Current topic prompt[\s\S]*?"([^"]+)"/i);
        if (m?.[1]) currentTopicPrompt = m[1];
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
      const completeFlag = Boolean(
        output && typeof output === 'object' && (output as { complete?: boolean }).complete,
      );
      // Interview finished or paused — never start another model turn (that caused post-complete hangs).
      if (userPaused || completeFlag || options?.continueResponse === false) return;
      requestResponseCreate();
    },

    transitionToTopic(instructions, questionIndex) {
      topicEpoch += 1;
      conductingQuestionIndex = questionIndex;
      const m = instructions.match(/Current topic prompt[\s\S]*?"([^"]+)"/i);
      if (m?.[1]) currentTopicPrompt = m[1];
      if (activeResponseId) {
        sendEvent({ type: 'response.cancel', response_id: activeResponseId });
        activeResponseId = null;
      }
      sendEvent({
        type: 'session.update',
        session: { type: 'realtime', instructions },
      });
      if (userPaused) {
        pendingResponseCreate = false;
        return;
      }
      pendingResponseCreate = true;
      flushPendingResponseCreate();
    },
  };
}

/** @deprecated Legacy chunked pipeline — use createOpenAiRealtimeInterview */
export function createAiVoiceInterview() {
  throw new Error('Use createOpenAiRealtimeInterview');
}
