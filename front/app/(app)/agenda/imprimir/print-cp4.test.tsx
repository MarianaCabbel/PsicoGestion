// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgendaPrintPage from './page';

const { apiMock, searchParamsMock, printMock, themeState } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  searchParamsMock: vi.fn(),
  printMock: vi.fn(),
  themeState: { theme: 'light' as 'light' | 'dark' },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('next/navigation', () => ({ useSearchParams: () => searchParamsMock() }));

vi.mock('@/components/providers/theme-provider', () => ({
  useTheme: () => ({ theme: themeState.theme, toggleTheme: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { priority, ...rest } = props;
    return <img {...rest} alt={String(rest.alt ?? '')} />;
  },
}));

type PrintAppointment = {
  folio: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  paciente: { nombre_completo: string };
  terapeuta: { nombre_completo: string };
  sala: { nombre: string };
};

function appointment(overrides: Partial<PrintAppointment> = {}): PrintAppointment {
  return {
    folio: 'CIT-2026-000001',
    fecha: '2026-10-20',
    hora_inicio: '09:00',
    hora_fin: '10:00',
    paciente: { nombre_completo: 'Lucía Solís' },
    terapeuta: { nombre_completo: 'Ana Terapeuta' },
    sala: { nombre: 'Sala A' },
    ...overrides,
  };
}

let params: URLSearchParams;

function setupApi(agenda: Record<string, unknown>) {
  apiMock.mockImplementation((path: string) => {
    if (String(path).startsWith('/api/agenda?')) {
      return Promise.resolve({ data: agenda });
    }
    return Promise.reject(new Error(`Unexpected API request: ${String(path)}`));
  });
}

async function renderPrint() {
  const utils = render(<AgendaPrintPage />);
  await waitFor(() => expect(apiMock).toHaveBeenCalled());
  return utils;
}

describe('Agenda imprimible CP4-INT', () => {
  beforeEach(() => {
    params = new URLSearchParams({ vista: 'dia', fecha: '2026-10-20' });
    searchParamsMock.mockImplementation(() => params);
    apiMock.mockReset();
    printMock.mockReset();
    themeState.theme = 'light';
    vi.stubGlobal('print', printMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('CP4-INT-22 imprime la vista diaria con los 24 lapsos y las citas del día', async () => {
    setupApi({
      vista: 'dia',
      fecha: '2026-10-20',
      desde: '2026-10-20',
      hasta: '2026-10-20',
      citas: [
        appointment(),
        appointment({
          folio: 'CIT-2026-000002',
          hora_inicio: '18:30',
          hora_fin: '19:00',
          paciente: { nombre_completo: 'Paciente Último' },
        }),
      ],
    });

    const { container } = await renderPrint();
    await screen.findAllByText(/CIT-2026-000001/);

    const filas = container.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(24);
    expect(filas[0]).toHaveTextContent('07:00–07:30');
    expect(filas[4]).toHaveTextContent('09:00–09:30');
    expect(filas[4]).toHaveTextContent('CIT-2026-000001');
    expect(filas[23]).toHaveTextContent('18:30–19:00');
    expect(filas[23]).toHaveTextContent('CIT-2026-000002');
    expect(screen.getByText(/Vista diaria/)).toBeInTheDocument();
  });

  it('CP4-INT-23 imprime la vista semanal como listado de citas', async () => {
    params = new URLSearchParams({ vista: 'semana', fecha: '2026-10-20' });
    setupApi({
      vista: 'semana',
      fecha: '2026-10-20',
      desde: '2026-10-19',
      hasta: '2026-10-25',
      citas: [
        appointment(),
        appointment({
          folio: 'CIT-2026-000002',
          fecha: '2026-10-21',
          hora_inicio: '11:00',
          hora_fin: '11:30',
        }),
      ],
    });

    await renderPrint();
    await screen.findByText('CIT-2026-000001');

    expect(screen.getByText(/Vista semanal/)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-19 — 2026-10-25/)).toBeInTheDocument();
    expect(screen.getByText('CIT-2026-000002')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Horario' })).toBeInTheDocument();
  });

  it('CP4-INT-24 imprime la vista mensual con el total de citas por día', async () => {
    params = new URLSearchParams({ vista: 'mes', fecha: '2026-10-20' });
    setupApi({
      vista: 'mes',
      fecha: '2026-10-20',
      desde: '2026-10-01',
      hasta: '2026-10-31',
      dias: [
        { fecha: '2026-10-19', total: 2, dia_atencion: true },
        { fecha: '2026-10-20', total: 0, dia_atencion: true },
        { fecha: '2026-10-25', total: 0, dia_atencion: false },
      ],
    });

    await renderPrint();
    await screen.findByText('2026-10-19');

    expect(screen.getByText(/Vista mensual/)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Citas' })).toBeInTheDocument();
    const fila = screen.getByText('2026-10-19').closest('tr');
    expect(fila).toHaveTextContent('Sí');
    expect(fila).toHaveTextContent('2');
    expect(screen.getByText('2026-10-25').closest('tr')).toHaveTextContent('No');
  });

  it('CP4-INT-25 oculta los nombres de pacientes por defecto y permite mostrarlos', async () => {
    setupApi({
      vista: 'dia',
      fecha: '2026-10-20',
      desde: '2026-10-20',
      hasta: '2026-10-20',
      citas: [appointment()],
    });

    await renderPrint();
    await screen.findAllByText(/CIT-2026-000001/);

    expect(screen.queryByText(/Lucía Solís/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ocultar nombres de pacientes')).toBeChecked();

    fireEvent.click(screen.getByLabelText('Ocultar nombres de pacientes'));

    expect((await screen.findAllByText(/Lucía Solís/)).length).toBeGreaterThan(0);
    expect(apiMock).toHaveBeenLastCalledWith(
      expect.stringContaining('privado=0'),
      expect.anything(),
    );
  });

  it('CP4-INT-26 distingue los lapsos libres y ocupados en la impresión diaria', async () => {
    setupApi({
      vista: 'dia',
      fecha: '2026-10-20',
      desde: '2026-10-20',
      hasta: '2026-10-20',
      citas: [appointment()],
    });

    const { container } = await renderPrint();
    await screen.findAllByText(/CIT-2026-000001/);

    const ocupados = container.querySelectorAll('tbody tr[data-estado="ocupado"]');
    const libres = container.querySelectorAll('tbody tr[data-estado="libre"]');

    expect(ocupados).toHaveLength(2);
    expect(libres).toHaveLength(22);
    expect(ocupados[0]).toHaveTextContent('Ocupado');
    expect(libres[0]).toHaveTextContent('Libre');
  });

  it('CP4-INT-27 genera la vista imprimible en menos de 5 segundos', async () => {
    setupApi({
      vista: 'dia',
      fecha: '2026-10-20',
      desde: '2026-10-20',
      hasta: '2026-10-20',
      citas: Array.from({ length: 20 }, (_, indice) => {
        const minutos = 7 * 60 + indice * 30;
        const hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
        const fin = `${String(Math.floor((minutos + 30) / 60)).padStart(2, '0')}:${String((minutos + 30) % 60).padStart(2, '0')}`;
        return appointment({
          folio: `CIT-2026-${String(indice + 1).padStart(6, '0')}`,
          hora_inicio: hora,
          hora_fin: fin,
        });
      }),
    });

    const started = performance.now();
    const { container } = await renderPrint();
    await waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(24));

    expect(performance.now() - started).toBeLessThan(5000);
    expect(screen.getByText(/CIT-2026-000020/)).toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr[data-estado="ocupado"]')).toHaveLength(20);
  });
});
