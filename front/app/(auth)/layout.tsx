import type { ReactNode } from 'react';
import { PrivacyFooter } from '@/components/app/privacy-footer';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="auth-shell">{children}</main>
      <PrivacyFooter />
    </>
  );
}
