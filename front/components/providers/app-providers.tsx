'use client';

import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/app/auth-guard';
import { SessionProvider } from './session-provider';
import { ThemeProvider } from './theme-provider';
import { Toaster } from '@/components/ui/toaster';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AuthGuard>{children}</AuthGuard>
        <Toaster />
      </SessionProvider>
    </ThemeProvider>
  );
}

export { SessionProvider };
