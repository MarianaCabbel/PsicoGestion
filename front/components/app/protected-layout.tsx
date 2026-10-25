'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PrivacyFooter } from '@/components/app/privacy-footer';
import { useSession } from '@/components/providers/session-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const navigation: { href: string; label: string; icon: string; adminOnly?: boolean }[] = [
  { href: '/panel', label: 'Inicio', icon: '⌂' },
  { href: '/agenda', label: 'Agenda', icon: '▦' },
  { href: '/pacientes', label: 'Pacientes', icon: '♡' },
  { href: '/citas', label: 'Citas', icon: '▦' },
  { href: '/salas', label: 'Salas', icon: '▤' },
  { href: '/terapeutas', label: 'Terapeutas', icon: '✚' },
  { href: '/auditoria', label: 'Bitácora', icon: '◷', adminOnly: true },
  { href: '/usuarios-accesos', label: 'Usuarios y accesos', icon: '⚙', adminOnly: true },
];

const routeNames: Record<string, string> = {
  panel: 'Inicio',
  agenda: 'Agenda',
  pacientes: 'Pacientes',
  citas: 'Citas',
  salas: 'Salas',
  terapeutas: 'Terapeutas',
  auditoria: 'Bitácora',
  'usuarios-accesos': 'Usuarios y accesos',
};

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, status, error, refresh, logout } = useSession();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión.');
    } finally {
      setLoggingOut(false);
    }
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <main className="session-loading" aria-label="Cargando sesión">
        <Skeleton className="session-loading-card" />
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="session-error" role="alert">
        <h1>No se pudo validar la sesión</h1>
        <p>{error}</p>
        <Button onClick={() => void refresh()}>Reintentar</Button>
      </main>
    );
  }

  const currentSegment = pathname.split('/').filter(Boolean)[0] ?? 'panel';
  const pageTitle = routeNames[currentSegment] ?? 'PsicoGestión';

  return (
    <div className={`workspace ${collapsed ? 'workspace--collapsed' : ''}`}>
      <aside className="workspace-sidebar" aria-label="Barra lateral">
        <Link aria-label="PsicoGestión, inicio" className="workspace-brand" href="/panel">
          <span className="workspace-brand-mark" aria-hidden="true">
            P
          </span>
          {!collapsed && <span>PsicoGestión</span>}
        </Link>
        <nav aria-label="Navegación principal" className="workspace-nav">
          {navigation
            .filter((item) => !item.adminOnly || user?.rol === 'administrador')
            .map((item) => (
              <Link
                aria-current={pathname === item.href ? 'page' : undefined}
                className={`workspace-nav-link ${pathname === item.href ? 'is-active' : ''}`}
                href={item.href}
                key={item.href}
                title={collapsed ? item.label : undefined}
              >
                <span aria-hidden="true" className="workspace-nav-icon">
                  {item.icon}
                </span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
        </nav>
        <div className="workspace-sidebar-footer">
          <Button
            aria-label={collapsed ? 'Expandir navegación' : 'Colapsar navegación'}
            className="workspace-collapse"
            onClick={() => setCollapsed((value) => !value)}
            variant="ghost"
          >
            <span aria-hidden="true">{collapsed ? '→' : '←'}</span>
            {!collapsed && <span>Contraer menú</span>}
          </Button>
          <Button
            className="workspace-theme"
            onClick={toggleTheme}
            variant="ghost"
            aria-label={theme === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'}
          >
            <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
            {!collapsed && <span>{theme === 'light' ? 'Tema oscuro' : 'Tema claro'}</span>}
          </Button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-header">
          <div>
            <nav aria-label="Migas de pan" className="workspace-breadcrumb">
              <Link href="/panel">Espacio de trabajo</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{pageTitle}</span>
            </nav>
            <h1 className="workspace-page-title">{pageTitle}</h1>
          </div>
          <div className="workspace-user">
            <div className="workspace-user-copy">
              <strong>{user?.nombre_completo}</strong>
              <span>{user?.rol}</span>
            </div>
            <Button disabled={loggingOut} onClick={() => void handleLogout()} variant="secondary">
              {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
            </Button>
          </div>
        </header>
        <main className="workspace-content">{children}</main>
        <PrivacyFooter />
      </div>
    </div>
  );
}
