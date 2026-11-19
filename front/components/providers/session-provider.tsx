'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '@/lib/api';
import { isPublicRoute } from '@/lib/public-routes';

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
  const sessionChecked = useRef(false);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    sessionChecked.current = true;
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
    // En rutas públicas no hay sesión que validar: consultar /api/auth/me sólo
    // produciría un 401 esperado, ralentizando la primera carga de la aplicación.
    if (isPublicRoute(pathname ?? '')) {
      setStatus((current) => (current === 'loading' ? 'unauthenticated' : current));
      return;
    }

    // Una sola comprobación por sesión, aunque se navegue entre rutas privadas.
    if (!sessionChecked.current) void refresh();
  }, [pathname, refresh]);

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
