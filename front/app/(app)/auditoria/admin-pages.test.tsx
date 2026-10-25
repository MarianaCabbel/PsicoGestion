// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditoriaPage from './page';
import UsersAndAccessPage from '../usuarios-accesos/page';

const { apiMock, replaceMock, sessionState } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  replaceMock: vi.fn(),
  sessionState: { user: { id: 1, rol: 'secretaria' } },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: replaceMock }) }));
vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => sessionState,
}));

describe('Admin-only pages', () => {
  beforeEach(() => {
    apiMock.mockReset();
    replaceMock.mockReset();
    sessionState.user = { id: 1, rol: 'secretaria' };
  });

  it('does not request or show audit and access data to a secretary', () => {
    const { rerender } = render(<AuditoriaPage />);
    expect(screen.getByRole('status')).toHaveTextContent('únicamente para administración');
    rerender(<UsersAndAccessPage />);
    expect(screen.getByRole('status')).toHaveTextContent('únicamente para administración');
    expect(apiMock).not.toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/panel');
  });
});
