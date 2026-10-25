'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '@/lib/api';

export type SessionUser = {
  id: number;
  nombre_completo: string;
  correo_institucional: string;
  rol: string;
};

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
type SessionContextValue = {
  user: SessionUser | null;
  status: SessionStatus;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const response = await api<SessionUser>('/api/auth/me', {
        redirectOnUnauthorized: false,
      });
      setUser(response.data);
      setStatus('authenticated');
    } catch (cause) {
      setUser(null);
      if (cause instanceof ApiError && cause.status === 401) {
        setStatus('unauthenticated');
        return;
      }
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar la sesión.');
      setStatus('error');
    }
  }, []);

  const logout = useCallback(async () => {
    await api<null>('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, status, error, refresh, logout }),
    [user, status, error, refresh, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe usarse dentro de SessionProvider.');
  return context;
}
