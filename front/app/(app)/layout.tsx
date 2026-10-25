import type { ReactNode } from 'react';
import { ProtectedLayout } from '@/components/app/protected-layout';

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
