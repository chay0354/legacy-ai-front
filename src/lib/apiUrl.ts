/** Normalized backend origin — strips trailing slashes so paths never become `//api/...`. */
export function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  return String(raw).replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl()}${normalized}`;
}
