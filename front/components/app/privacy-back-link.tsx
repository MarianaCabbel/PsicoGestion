'use client';

import Link from 'next/link';
import { useSession } from '@/components/providers/session-provider';

/**
 * El aviso de privacidad se puede abrir desde la pantalla de acceso o desde el panel.
 * Con sesión activa regresa al panel; sin sesión, al acceso.
 * Si useSession no tiene contexto (fuera de SessionProvider), muestra enlace seguro.
 */
export function PrivacyBackLink() {
  try {
    const { status } = useSession();
    const authenticated = status === 'authenticated';

    return (
      <Link
        className="ui-button ui-button--secondary ui-button--md"
        href={authenticated ? '/panel' : '/login'}
      >
        {authenticated ? 'Volver al panel' : 'Volver al acceso'}
      </Link>
    );
  } catch {
    // Fallback cuando no hay SessionProvider (tests, SSR, etc.)
    return (
      <Link
        className="ui-button ui-button--secondary ui-button--md"
        href="/login"
      >
        Volver al acceso
      </Link>
    );
  }
}