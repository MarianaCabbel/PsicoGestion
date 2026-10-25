'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSession } from '@/components/providers/session-provider';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { logout } = useSession();

  async function handleLogout() {
    setLoading(true);

    try {
      await logout();
      router.replace('/login');
    } catch (logoutError) {
      toast.error(
        logoutError instanceof Error ? logoutError.message : 'No se pudo cerrar la sesión.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="logout-control">
      <button
        className="app-logout"
        type="button"
        onClick={() => void handleLogout()}
        disabled={loading}
      >
        {loading ? 'Cerrando…' : 'Cerrar sesión'}
      </button>
    </div>
  );
}
