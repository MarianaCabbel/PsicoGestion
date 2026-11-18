// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import TerapeutasPage from './page';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => ({
    status: 'authenticated' as 'loading' | 'authenticated' | 'unauthenticated' | 'error',
    error: null as string | null,
    refresh: vi.fn(),
    user: { id: 1, nombre_completo: 'Test User', rol: 'psicologo' },
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

describe('TerapeutasPage', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('renders the terapeutas page header', async () => {
    render(<TerapeutasPage />);
    const heading = screen.getByRole('heading', { name: /terapeutas/i });
    expect(heading).toBeVisible();
  });

  it('loads terapeutas from API', async () => {
    apiMock.mockResolvedValue({
      data: {
        items: [
          { id: 1, nombre_completo: 'Ana Terapeuta', rol: 'psicologo' },
          { id: 2, nombre_completo: 'Carlos Terapeuta', rol: 'psicologo' },
        ],
      },
    });

    render(<TerapeutasPage />);
    await waitFor(() =>
      expect(screen.getByText('Ana Terapeuta')).toBeVisible(),
    );
    await waitFor(() =>
      expect(screen.getByText('Carlos Terapeuta')).toBeVisible(),
    );
  });

  it('shows empty state when no terapeutas are available', async () => {
    apiMock.mockResolvedValue({ data: { items: [] } });

    render(<TerapeutasPage />);
    await waitFor(() =>
      expect(screen.getByText(/no hay terapeutas|no hay registros/)).toBeVisible(),
    );
  });
});