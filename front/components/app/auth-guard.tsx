'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/components/providers/session-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/** Rutas a las que se puede entrar sin sesión iniciada. */
const PUBLIC_ROUTES = ['/login', '/registro', '/recuperar', '/reset-password', '/verificar'];

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Puerta de acceso del frontend: cualquier ruta que no sea pública exige una sesión válida.
 * Las páginas públicas (acceso, registro y recuperación de contraseña) se muestran siempre.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = isPublicRoute(pathname ?? '');
  const requiresSession = !isPublic;

  useEffect(() => {
    if (requiresSession && status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [requiresSession, status, router]);

  if (isPublic) return <>{children}</>;
  if (status === 'authenticated') return <>{children}</>;

  if (status === 'error') {
    return (
      <main className="session-error" role="alert">
        <h1>No se pudo validar la sesión</h1>
        <p>{error}</p>
        <Button onClick={() => void refresh()}>Reintentar</Button>
      </main>
    );
  }

  return (
    <main className="session-loading" aria-label="Cargando sesión">
      <Skeleton className="session-loading-card" />
    </main>
  );
}
