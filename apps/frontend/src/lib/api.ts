const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api/v1';
const TOKEN_KEY = 'pa.accessToken';
const REFRESH_KEY = 'pa.refreshToken';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function saveTokens(access: string, refresh?: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
    if (!refresh) window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

/** Alias compatible con el contexto de sesión. */
export const storeSession = saveTokens;

export function setTokensData(access: string, refresh?: string): void {
  saveTokens(access, refresh);
}

export function clearTokens(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

/** Alias compatible con el contexto de sesión. */
export const clearStoredSession = clearTokens;

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RequestOptions {
  /** `false` omite el header Authorization (rutas públicas). */
  auth?: boolean;
}

export async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  const access = getAccessToken();
  if (!refresh || !access) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const json = (await res.json()) as { user?: unknown; tokens: AuthTokens };
    if (json.tokens?.accessToken) {
      saveTokens(json.tokens.accessToken, json.tokens.refreshToken);
      return true;
    }
    clearTokens();
    return false;
  } catch {
    return false;
  }
}

export const api = {
  async get<T>(p: string, opts?: RequestOptions): Promise<T> {
    return request<T>(p, { method: 'GET' }, opts);
  },
  async post<T>(p: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>(p, { method: 'POST', body }, opts);
  },
  async patch<T>(p: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>(p, { method: 'PATCH', body }, opts);
  },
  async put<T>(p: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>(p, { method: 'PUT', body }, opts);
  },
  async delete<T>(p: string, opts?: RequestOptions): Promise<T> {
    return request<T>(p, { method: 'DELETE' }, opts);
  },
};

/** Alias de `api` (contexto de sesión). */
export const apiClient = api;

async function request<T>(
  path: string,
  init: { method: string; body?: unknown },
  opts?: RequestOptions,
): Promise<T> {
  const auth = opts?.auth !== false;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = auth ? getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(init.body);
  }

  let res = await fetch(`${API_URL}${path}`, {
    method: init.method,
    headers,
    body: payload,
  });

  if (res.status === 401 && auth) {
    const refreshed = await refreshAccessToken();
    const newToken = getAccessToken();
    if (refreshed && newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, {
        method: init.method,
        headers,
        body: payload,
      });
      return handle<T>(res);
    }
    clearTokens();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }

  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    let code: string | undefined;
    let details: unknown;
    try {
      const body = (await res.json()) as {
        message?: string;
        code?: string;
        details?: unknown;
        error?: string;
      };
      msg = body.message ?? body.error ?? msg;
      code = body.code;
      details = body.details;
    } catch {
      /* cuerpo no JSON */
    }
    throw new ApiError(res.status, msg, code, details);
  }
  return (await res.json()) as T;
}