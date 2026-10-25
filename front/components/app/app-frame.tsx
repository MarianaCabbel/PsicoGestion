import type { ReactNode } from 'react';

export function AppFrame({ children }: { children: ReactNode }) {
  return <section className="app-content">{children}</section>;
}
