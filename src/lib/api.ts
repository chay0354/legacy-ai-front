import { supabase } from './supabase';
import { ACTIONS, can, type Role } from './permissions';
import { apiUrl } from './apiUrl';

let cachedAuth: { token: string; expiresAtMs: number } | null = null;

/** Call after sign-in / sign-out so API requests use the current session token. */
export function clearAuthTokenCache() {
  cachedAuth = null;
}

export function isAuthError(message: string) {
  return /invalid or expired token|not authenticated|missing authorization|401/i.test(message);
}

async function resolveAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedAuth && cachedAuth.expiresAtMs > now + 60_000) {
    return cachedAuth.token;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const expiresAtMs = (session?.expires_at ?? 0) * 1000;
  const stillValid = session?.access_token && expiresAtMs > now + 60_000;

  if (!forceRefresh && stillValid && session?.access_token) {
    cachedAuth = { token: session.access_token, expiresAtMs };
    return session.access_token;
  }

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  const next = refreshed.session;
  if (error || !next?.access_token) {
    cachedAuth = null;
    throw new Error('Invalid or expired token');
  }

  cachedAuth = {
    token: next.access_token,
    expiresAtMs: (next.expires_at ?? 0) * 1000,
  };
  return next.access_token;
}

export async function authHeaders(forceRefresh = false) {
  const token = await resolveAccessToken(forceRefresh);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch(path: string, options: RequestInit = {}, retried = false) {
  const headers = await authHeaders(retried);
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (res.status === 401 && !retried) {
    clearAuthTokenCache();
    return apiFetch(path, options, true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `API error ${res.status}`) as Error & {
      liveCallAvailable?: boolean;
      code?: string;
    };
    if ((data as { liveCallAvailable?: boolean }).liveCallAvailable) err.liveCallAvailable = true;
    if ((data as { code?: string }).code) err.code = (data as { code: string }).code;
    throw err;
  }
  return data;
}

export type { Role } from './permissions';

export interface RolePermissions {
  view: boolean;
  chat: boolean;
  interview: boolean;
  editContent: boolean;
  manageProfile: boolean;
  invite: boolean;
  inviteAdmin: boolean;
  manageRoles: boolean;
  removeMembers: boolean;
}

export interface Membership {
  creatorId: string;
  role: Role;
  displayName: string | null;
  completionScore: number | null;
  avatarLevel: number | null;
  isOwner: boolean;
  permissions: RolePermissions;
}

export interface PendingInvitation {
  token: string;
  role: Role;
  creatorId: string;
  creatorDisplayName: string | null;
}

export interface AccessMe {
  user: { id: string; email: string | null; name: string | null };
  memberships: Membership[];
  pendingInvitations: PendingInvitation[];
}

export interface MemberRow {
  user_id: string;
  role: Role;
  created_at: string;
  email: string | null;
  name: string | null;
}

export interface InvitationRow {
  id: string;
  email: string | null;
  role: Role;
  token: string;
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
  expires_at: string;
}

export interface InvitePreview {
  role: Role;
  creatorId: string;
  creatorDisplayName: string | null;
  expiresAt: string;
  alreadyAccepted?: boolean;
}

// Derived entirely from the canonical matrix in ./permissions so the three
// roles can never drift out of sync. To change a permission, edit permissions.ts.
export function permissionsForRole(role: Role): RolePermissions {
  return {
    view: can(role, ACTIONS.VIEW_CONTENT),
    chat: can(role, ACTIONS.CHAT_WITH_AVATAR),
    interview: can(role, ACTIONS.COMPLETE_INTERVIEW),
    editContent: can(role, ACTIONS.EDIT_MEMORY),
    manageProfile: can(role, ACTIONS.EDIT_PROFILE),
    invite: can(role, ACTIONS.INVITE_USER),
    inviteAdmin: can(role, ACTIONS.APPOINT_ADMIN),
    manageRoles: can(role, ACTIONS.MANAGE_ACCESS),
    removeMembers: can(role, ACTIONS.MANAGE_ACCESS),
  }
}

function qs(params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter(([, v]) => v != null) as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

export const accessApi = {
  me: () => apiFetch('/api/access/me') as Promise<AccessMe>,

  members: (creatorId?: string) =>
    apiFetch(`/api/access/members${qs({ creatorId })}`) as Promise<{ creatorId: string; role: Role; members: MemberRow[] }>,

  invitations: (creatorId?: string) =>
    apiFetch(`/api/access/invitations${qs({ creatorId })}`) as Promise<{ creatorId: string; invitations: InvitationRow[] }>,

  invite: (payload: { role: Role; creatorId?: string }) =>
    apiFetch('/api/access/invitations', { method: 'POST', body: JSON.stringify(payload) }) as Promise<{ invitation: InvitationRow }>,

  previewInvite: (token: string) =>
    fetch(apiUrl(`/api/access/invite/${encodeURIComponent(token)}`)).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
      return data as InvitePreview;
    }),

  acceptInvitation: (token: string) =>
    apiFetch(`/api/access/invitations/${token}/accept`, { method: 'POST' }) as Promise<{ success: boolean; creatorId: string; role: Role; creatorDisplayName: string | null }>,

  revokeInvitation: (id: string, creatorId?: string) =>
    apiFetch(`/api/access/invitations/${id}${qs({ creatorId })}`, { method: 'DELETE' }) as Promise<{ success: boolean }>,

  setMemberRole: (userId: string, role: Role, creatorId?: string) =>
    apiFetch(`/api/access/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role, creatorId }) }) as Promise<{ success: boolean }>,

  removeMember: (userId: string, creatorId?: string) =>
    apiFetch(`/api/access/members/${userId}${qs({ creatorId })}`, { method: 'DELETE' }) as Promise<{ success: boolean }>,
};

export interface QuestionMeta {
  module: string;
  category: string;
  q: string;
}

export interface SavedAnswer {
  question_index: number;
  question: string;
  answer: string;
  answer_mode: 'voice' | 'text';
  skipped: boolean;
}

export interface InterviewSessionData {
  session: { id: string; label: string; status: string; stage?: string };
  creator: { id: string; display_name: string; avatar_level: number; completion_score: number };
  stage: 'foundation' | 'enriched' | 'legacy';
  stageLabel: string;
  stageGoal?: string;
  stages?: { id: string; label: string; done?: boolean; current?: boolean }[];
  allStagesComplete?: boolean;
  questions: { q: string }[];
  questionMeta: QuestionMeta[];
  savedAnswers: SavedAnswer[];
  resumeIndex: number;
}

export interface CompleteResult {
  success: boolean
  stage?: 'foundation' | 'enriched' | 'legacy'
  session_summary: string
  recommended_next_topics: string[]
  coverage: Record<string, number>
  completion_score: number
  avatar_level: number
  counts: {
    memories: number
    relationships: number
    values: number
    wisdom: number
    threads: number
  }
}

export interface AvatarAssets {
  creator_id: string;
  voice_id: string | null;
  voice_status: 'none' | 'processing' | 'ready' | 'failed';
  voice_sample_path: string | null;
  portrait_path: string | null;
  idle_video_path: string | null;
  speaking_video_path: string | null;
  metadata?: {
    cloned?: boolean;
    avatar_status?: 'none' | 'processing' | 'ready' | 'failed';
    heygen_photo_avatar_id?: string | null;
    heygen_avatar_preview_url?: string | null;
    [key: string]: unknown;
  };
}

export interface AvatarAssetsResponse {
  creatorId: string | null;
  displayName?: string | null;
  assets: AvatarAssets | null;
  voiceCloned?: boolean;
  avatarReady?: boolean;
  liveReady?: boolean;
  hasPortrait?: boolean;
  previewUrl?: string | null;
  urls?: { portrait?: string | null; idle?: string | null; speaking?: string | null; voiceSample?: string | null };
}

const MEDIA_BUCKET = 'legacy-media';

/** Upload a recorded/captured blob to the creator's media folder; returns the storage path. */
export async function uploadMedia(creatorId: string, kind: string, blob: Blob, ext: string, contentType?: string): Promise<string> {
  const path = `${creatorId}/${kind}-${Date.now()}.${ext}`;
  const type = contentType || blob.type || undefined;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: type,
  });
  if (error) throw new Error(error.message);
  return path;
}

export const avatarApi = {
  /** Pass light: true on home screens — skips signed media URLs (faster). */
  getAssets: (opts?: { light?: boolean; creatorId?: string }) => {
    const params = new URLSearchParams();
    if (opts?.light) params.set('light', '1');
    if (opts?.creatorId) params.set('creatorId', opts.creatorId);
    const q = params.toString();
    return apiFetch(`/api/avatar/assets${q ? `?${q}` : ''}`) as Promise<AvatarAssetsResponse>;
  },

  cloneVoice: (voiceSamplePath: string) =>
    apiFetch('/api/avatar/voice', { method: 'POST', body: JSON.stringify({ voiceSamplePath }) }) as Promise<{
      success: boolean; voiceId: string; cloned: boolean; voiceProvider?: string; message?: string; assets: AvatarAssets;
    }>,

  /** Save a voice recording for family to hear on the avatar page (no live-avatar cloning). */
  saveVoiceSample: (voiceSamplePath: string) =>
    apiFetch('/api/avatar/voice-sample', { method: 'POST', body: JSON.stringify({ voiceSamplePath }) }) as Promise<{
      success: boolean
      voiceSampleUrl: string | null
      assets: AvatarAssets
    }>,

  saveAssets: (payload: { portraitPath?: string; idleVideoPath?: string; speakingVideoPath?: string }) =>
    apiFetch('/api/avatar/assets', { method: 'PUT', body: JSON.stringify(payload) }) as Promise<AvatarAssetsResponse>,

  /** Register portrait + voice as live (Anam) and talking (HeyGen) avatars. Polls until liveReady on Vercel. */
  provision: async (opts?: { onProgress?: (phase: string) => void }) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    type ProvisionResult = {
      success: boolean;
      status?: string;
      avatarReady: boolean;
      liveReady?: boolean;
      heygenPhotoAvatarId: string | null;
      previewUrl: string | null;
      assets: AvatarAssets;
      message?: string;
    };

    const initial = (await apiFetch('/api/avatar/provision', { method: 'POST' })) as ProvisionResult;
    if (initial.liveReady) return initial;
    if (initial.status !== 'processing') return initial;

    opts?.onProgress?.('Creating your live avatar…');
    for (let i = 0; i < 90; i++) {
      await sleep(3000);
      const polled = await avatarApi.getAssets({ light: true });
      if (polled.liveReady && polled.assets) {
        return {
          success: true,
          status: 'ready',
          avatarReady: polled.avatarReady,
          liveReady: true,
          heygenPhotoAvatarId: polled.assets.metadata?.heygen_photo_avatar_id ?? null,
          previewUrl: polled.previewUrl ?? null,
          assets: polled.assets,
        };
      }
      const anamStatus = polled.assets?.metadata?.anam_status;
      if (anamStatus === 'failed') {
        throw new Error(polled.assets?.metadata?.anam_error || 'Live avatar setup failed');
      }
      opts?.onProgress?.(i < 20 ? 'Creating your live avatar…' : 'Almost there…');
    }
    throw new Error('Live avatar setup is taking longer than expected. Refresh and try again.');
  },

  /** Ask the avatar a question; resolves to the answer text (in the person's own voice). */
  ask: (question: string, creatorId?: string) =>
    apiFetch('/api/avatar/ask', { method: 'POST', body: JSON.stringify({ question, creatorId }) }) as Promise<{
      answer: string; creatorId: string;
    }>,

  /** Start rendering a HeyGen talking video of the avatar speaking `text`. Returns videoId + audio URL for immediate playback. */
  say: (text: string, creatorId?: string) =>
    apiFetch('/api/avatar/say', { method: 'POST', body: JSON.stringify({ text, creatorId }) }) as Promise<{
      videoId: string | null; audioUrl: string | null; voiceCloned: boolean;
      audioOnly?: boolean; notice?: string;
    }>,

  /** Poll a HeyGen render once. */
  pollVideo: (videoId: string) =>
    apiFetch(`/api/avatar/video/${encodeURIComponent(videoId)}`) as Promise<{
      status: 'pending' | 'processing' | 'completed' | 'failed'; url: string | null; error: string | null;
    }>,

  greetingText: () => apiFetch('/api/avatar/greeting-text') as Promise<{ text: string }>,

  /** Start a real-time Anam live call with the legacy's own face + voice; returns a session token. */
  startLive: (creatorId?: string) =>
    apiFetch('/api/avatar/live/start', { method: 'POST', body: JSON.stringify({ creatorId }) }) as Promise<{
      sessionToken: string;
      usingOwnFace: boolean;
      usingOwnVoice: boolean;
      creatorId: string;
      videoProfile?: { videoWidth?: number; videoHeight?: number; videoQuality?: string };
    }>,

  /**
   * Render the avatar speaking `text`. Plays cloned voice audio as soon as it's ready,
   * then polls until the HeyGen talking video is ready.
   */
  renderTalkingVideo: async (
    text: string,
    creatorId?: string,
    opts?: {
      onProgress?: (status: 'starting' | 'pending' | 'processing') => void;
      onAudio?: (audioUrl: string) => void;
      onAudioOnly?: (notice: string) => void;
      onLiveCallHint?: (notice: string) => void;
    },
  ): Promise<string | null> => {
    opts?.onProgress?.('starting');
    let sayRes: Awaited<ReturnType<typeof avatarApi.say>>;
    try {
      sayRes = await avatarApi.say(text, creatorId);
    } catch (e) {
      const err = e as Error & { liveCallAvailable?: boolean };
      if (err.liveCallAvailable) {
        opts?.onLiveCallHint?.(err.message);
        return null;
      }
      throw e;
    }

    const { videoId, audioUrl, audioOnly, notice } = sayRes;
    if (audioUrl && opts?.onAudio) opts.onAudio(audioUrl);
    if (audioOnly || !videoId) {
      if (notice && opts?.onAudioOnly) opts.onAudioOnly(notice);
      return null;
    }

    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const { status, url, error } = await avatarApi.pollVideo(videoId);
      if (status === 'completed' && url) return url;
      if (status === 'failed') throw new Error(error || 'Talking video failed to render');
      opts?.onProgress?.(status === 'pending' ? 'pending' : 'processing');
    }
    throw new Error('Talking video timed out');
  },

  /** Render text in the cloned voice; resolves to a playable audio src (URL or object URL). */
  speak: async (text: string, creatorId?: string) => {
    const headers = await authHeaders();
    const res = await fetch(apiUrl('/api/avatar/speak'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, creatorId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `API error ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return data.audioUrl as string;
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};

export const interviewApi = {
  getSession: (opts?: { stage?: string }) => {
    const q = opts?.stage ? `?stage=${encodeURIComponent(opts.stage)}` : ''
    return apiFetch(`/api/interview/session${q}`) as Promise<InterviewSessionData>
  },

  saveAnswer: (sessionId: string, payload: {
    questionIndex: number;
    question: string;
    answer: string;
    mode: 'voice' | 'text';
    skipped?: boolean;
  }) => apiFetch(`/api/interview/session/${sessionId}/answer`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),

  complete: (sessionId: string, payload: {
    durationSeconds: number;
    answers: Array<{
      questionIndex: number;
      question: string;
      answer: string;
      mode: 'voice' | 'text';
    }>;
  }) => apiFetch(`/api/interview/session/${sessionId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<CompleteResult>,

  getProfile: (creatorId?: string) =>
    apiFetch(`/api/interview/profile${creatorId ? `?creatorId=${encodeURIComponent(creatorId)}` : ''}`) as Promise<
      import('./mapAvatarData').LegacyProfile & { role?: import('./api').Role }
    >,

  createMemory: (payload: {
    creatorId: string
    title: string
    summary: string
    year?: string
    category?: string
  }) =>
    apiFetch('/api/interview/memories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }) as Promise<{ memory: { id: string; title: string; summary: string; category?: string; year?: string } }>,

  updateMemory: (id: string, payload: {
    title?: string
    summary?: string
    year?: string
    category?: string
  }) =>
    apiFetch(`/api/interview/memories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }) as Promise<{ memory: { id: string; title: string; summary: string; category?: string; year?: string } }>,

  deleteMemory: (id: string) =>
    apiFetch(`/api/interview/memories/${id}`, { method: 'DELETE' }) as Promise<{ success: boolean; id: string }>,

  createGalleryItem: (payload: {
    creatorId: string
    imagePath: string
    caption: string
    title?: string
  }) =>
    apiFetch('/api/interview/gallery', {
      method: 'POST',
      body: JSON.stringify(payload),
    }) as Promise<{ item: { id: string; imageUrl: string | null; caption: string; title?: string } }>,

  deleteGalleryItem: (id: string) =>
    apiFetch(`/api/interview/gallery/${id}`, { method: 'DELETE' }) as Promise<{ success: boolean; id: string }>,
};
