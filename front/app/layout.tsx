import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PsicoGestión',
  description: 'Plataforma de gestión clínica de PsicoGestión',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.variable}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
