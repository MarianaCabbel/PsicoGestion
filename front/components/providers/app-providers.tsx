'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from './session-provider';
import { ThemeProvider } from './theme-provider';
import { Toaster } from '@/components/ui/toaster';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        {children}
        <Toaster />
      </SessionProvider>
    </ThemeProvider>
  );
}
