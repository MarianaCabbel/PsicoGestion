'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  CalendarClock,
  CalendarDays,
  DoorOpen,
  Home,
  LogOut,
  Menu,
  type LucideIcon,
  X,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Stethoscope,
  Sun,
  UserCog,
  Users,
} from 'lucide-react';
import { PrivacyFooter } from '@/components/app/privacy-footer';
import { useSession } from '@/components/providers/session-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const navigation: { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { href: '/panel', label: 'Inicio', icon: Home },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/citas', label: 'Citas', icon: CalendarClock },
  { href: '/salas', label: 'Salas', icon: DoorOpen },
  { href: '/terapeutas', label: 'Terapeutas', icon: Stethoscope },
  { href: '/auditoria', label: 'Bitácora', icon: ScrollText, adminOnly: true },
  { href: '/usuarios-accesos', label: 'Usuarios y accesos', icon: UserCog, adminOnly: true },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    function handlePointerDown(event: PointerEvent) {
      const sidebar = document.querySelector('.workspace-sidebar');
      const trigger = document.querySelector('.workspace-mobile-menu');
      const target = event.target as Node;
      if (sidebar?.contains(target) || trigger?.contains(target)) return;
      setMobileOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

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
    <div className={`workspace ${collapsed ? 'workspace--collapsed' : ''} ${mobileOpen ? 'workspace--mobile-open' : ''}`}>
      {mobileOpen && (
        <div className="workspace-mobile-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}
      <aside className={`workspace-sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Barra lateral">
        <Link aria-label="PsicoGestión, inicio" className="workspace-brand" href="/panel">
          <Image
            alt=""
            aria-hidden="true"
            className="workspace-brand-mark"
            height={38}
            priority
            src={theme === 'light' ? '/logo_light-mode.png' : '/logo_dark-mode.png'}
            width={38}
          />
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
                onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
              >
                <span aria-hidden="true" className="workspace-nav-icon">
                  <item.icon size={20} strokeWidth={1.8} />
                </span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
        </nav>
        <div className="workspace-sidebar-footer">
          {!collapsed && (
            <div className="workspace-sidebar-user">
              <strong>{user?.nombre_completo}</strong>
              <span>Administrador</span>
            </div>
          )}
          <Button
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            variant="ghost"
            aria-label="Cerrar sesión"
            className="workspace-logout"
          >
            <span aria-hidden="true">
              <LogOut size={18} />
            </span>
            {!collapsed && <span>{loggingOut ? 'Saliendo…' : 'Cerrar sesión'}</span>}
          </Button>
          <Button
            aria-label={collapsed ? 'Expandir navegación' : 'Colapsar navegación'}
            className="workspace-collapse"
            onClick={() => setCollapsed((value) => !value)}
            variant="ghost"
          >
            <span aria-hidden="true">
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </span>
            {!collapsed && <span>Contraer menú</span>}
          </Button>
          <Button
            className="workspace-theme"
            onClick={toggleTheme}
            variant="ghost"
            aria-label={theme === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'}
          >
            <span aria-hidden="true">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </span>
            {!collapsed && <span>{theme === 'light' ? 'Tema oscuro' : 'Tema claro'}</span>}
          </Button>
        </div>
      </aside>

      <div className="workspace-main">
        <div className="workspace-mobile-topbar">
          {!mobileOpen && (
            <button
              type="button"
              className="workspace-mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
          )}
          <span className="workspace-mobile-title">{pageTitle}</span>
        </div>
        <main className="workspace-content">{children}</main>
        <PrivacyFooter />
      </div>
    </div>
  );
}
