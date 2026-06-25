// Selalu /api di browser — Next.js proxy ke Laravel (hindari localhost tertanam di build)
const API_URL =
  typeof window !== 'undefined'
    ? '/api'
    : process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export function extractApiErrorMessage(
  data: Record<string, unknown>,
  fallback = 'Request failed'
): string {
  if (typeof data.message === 'string' && data.message) return data.message;
  const errors = data.errors;
  if (errors && typeof errors === 'object') {
    for (const messages of Object.values(errors as Record<string, string[]>)) {
      if (Array.isArray(messages) && messages[0]) return messages[0];
    }
  }
  if (Array.isArray(data.login) && data.login[0]) return String(data.login[0]);
  if (Array.isArray(data.email) && data.email[0]) return String(data.email[0]);
  return fallback;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('wo_token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('wo_token');
    localStorage.removeItem('wo_user');
    window.location.href = '/login';
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractApiErrorMessage(data, 'Request failed'));
  }
  return data as T;
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('wo_token');
    localStorage.removeItem('wo_user');
    window.location.href = '/login';
    return;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Download gagal');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiUploadFile<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('wo_token');
    localStorage.removeItem('wo_user');
    window.location.href = '/login';
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Upload gagal');
  }
  return data as T;
}

export const authApi = {
  login: (login: string, password: string) =>
    api<{ user: import('./types').User; token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),
  me: () => api<import('./types').User>('/me'),
  logout: () => api('/logout', { method: 'POST' }),
};
