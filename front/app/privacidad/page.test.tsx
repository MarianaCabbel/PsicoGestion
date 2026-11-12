// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrivacyNoticePage from './page';

const { sessionState } = vi.hoisted(() => ({
  sessionState: { status: 'unauthenticated' as 'loading' | 'authenticated' | 'unauthenticated' },
}));

vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => sessionState,
}));

describe('PrivacyNoticePage', () => {
  beforeEach(() => {
    sessionState.status = 'unauthenticated';
  });

  it('publishes a versioned privacy notice with ARCO information', () => {
    render(<PrivacyNoticePage />);
    expect(screen.getByRole('heading', { name: 'Aviso de privacidad' })).toBeVisible();
    expect(screen.getByText(/Versión v1\.0/)).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Derechos ARCO y revocación del consentimiento' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Aviso de privacidad v1.0' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver al acceso' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('returns to the panel when a session is active', () => {
    sessionState.status = 'authenticated';
    render(<PrivacyNoticePage />);
    expect(screen.getByRole('link', { name: 'Volver al panel' })).toHaveAttribute(
      'href',
      '/panel',
    );
  });
});