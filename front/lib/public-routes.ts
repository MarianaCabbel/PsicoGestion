/** Rutas a las que se puede entrar sin sesión iniciada. */
export const PUBLIC_ROUTES = [
  '/login',
  '/registro',
  '/recuperar',
  '/reset-password',
  '/verificar',
  '/privacidad',
] as const;

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
