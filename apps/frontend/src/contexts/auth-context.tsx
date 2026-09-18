'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from 'react';

import {
  apiClient,
  clearStoredSession,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  storeSession,
} from '@/lib/api';
import type { AuthResult, User } from '@/lib/types';

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** `true` mientras se hidrata el usuario con /auth/me al montar. */
  isLoading: boolean;
  setSession: (result: AuthResult) => void;
  clearSession: () => void;
  login: (email: string, password: string, recaptchaToken?: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthProviderContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/* Sesión como sistema externo (cookies solo-cliente): el servidor y la
   hidratación usan las snapshots sin sesión → SSR estable (evita #418). */
const SESSION_EVENT = 'pa:session-change';

function subscribeToSession(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SESSION_EVENT, onStoreChange);
  return () => window.removeEventListener(SESSION_EVENT, onStoreChange);
}

function getSessionToken(): string | null {
  return getAccessToken();
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const accessToken = useSyncExternalStore(subscribeToSession, getSessionToken, () => null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!accessToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const meUser = await apiClient.post<User>('/auth/me');
        if (!cancelled) setUser(meUser);
      } catch {
        if (cancelled) return;
        setUser(null);
        clearStoredSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const setSession = useCallback((result: AuthResult) => {
    storeSession(result.tokens.accessToken, result.tokens.refreshToken);
    setUser(result.user);
  }, []);

  const clearSession = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string, recaptchaToken?: string): Promise<User> => {
      const result = await apiClient.post<AuthResult>(
        '/auth/login',
        { email, password, recaptchaToken },
        { auth: false },
      );
      setSession(result);
      return result.user;
    },
    [setSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<User> => {
      const result = await apiClient.post<AuthResult>(
        '/auth/register',
        payload,
        { auth: false },
      );
      setSession(result);
      return result.user;
    },
    [setSession],
  );

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      void apiClient.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(accessToken),
      isLoading,
      setSession,
      clearSession,
      login,
      register,
      logout,
      refresh: refreshAccessToken,
    }),
    [user, accessToken, isLoading, setSession, clearSession, login, register, logout],
  );

  return <AuthProviderContext.Provider value={value}>{children}</AuthProviderContext.Provider>;
}

export function useAuthAdmin(): AuthContextValue {
  const ctx = useContext(AuthProviderContext);
  if (!ctx) {
    throw new Error('useAuthAdmin debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}