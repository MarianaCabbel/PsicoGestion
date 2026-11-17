// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PanelPage from './page';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

const summary = {
  fecha: '2026-10-20',
  citas_hoy: 4,
  pendientes_semana: 12,
  pacientes_activos: 30,
  terapeutas_activos: 5,
  ocupacion_salas: [
    { id: 1, nombre: 'Sala A', bloques_ocupados: 6, bloques_totales: 24, porcentaje: 25 },
    { id: 2, nombre: 'Sala B', bloques_ocupados: 0, bloques_totales: 24, porcentaje: 0 },
  ],
  proximas_citas: [
    {
      id: 7,
      folio: 'CIT-2026-000123',
      fecha: '2026-10-20',
      hora_inicio: '09:00',
      hora_fin: '09:30',
      paciente: 'Lucía Solís',
      terapeuta: 'Ana Terapeuta',
      sala: 'Sala A',
    },
  ],
};

describe('Panel CP4-INT', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('CP4-INT-28 el inicio muestra la agenda del día y sus indicadores', async () => {
    apiMock.mockResolvedValue({ data: summary });

    render(<PanelPage />);

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/api/dashboard/resumen', expect.anything()));

    expect(screen.getByRole('heading', { name: 'Próximas citas' })).toBeVisible();
    expect(screen.getByText('Lucía Solís')).toBeVisible();
    expect(screen.getByText('CIT-2026-000123')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ocupación de salas' })).toBeVisible();
    expect(screen.getByRole('progressbar', { name: /Sala A: 25% de ocupación/ })).toBeVisible();
    expect(screen.getByText('4')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Abrir agenda' })).toHaveAttribute('href', '/agenda');
  });
});
