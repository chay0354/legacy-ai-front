import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AuthSessionResponse {
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    expires_in?: number;
  } | null;
  user: { id: string; email: string | null; name: string | null } | null;
  needsEmailConfirmation?: boolean;
}

async function postAuth(path: string, body: Record<string, string>) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Authentication failed (${res.status})`);
  }
  return data as AuthSessionResponse;
}

/** Sign in through the backend API, then persist the session in the browser client. */
export async function signInWithPassword(email: string, password: string) {
  const data = await postAuth('/api/auth/sign-in', { email, password });
  if (!data.session) throw new Error('Sign in succeeded but no session was returned');
  const { error } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (error) throw error;
  return data;
}

/** Sign up through the backend API; sets session when email confirmation is off. */
export async function signUpWithPassword(name: string, email: string, password: string) {
  const data = await postAuth('/api/auth/sign-up', { name, email, password });
  if (data.session) {
    const { error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (error) throw error;
  }
  return data;
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, redirectTo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
}
