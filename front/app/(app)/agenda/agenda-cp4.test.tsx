// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgendaPage from './page';

const { apiMock, pushMock } = vi.hoisted(() => ({ apiMock: vi.fn(), pushMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

type Appointment = {
  id: number;
  folio: string;
  estado: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_slots: number;
  paciente: { id: number; nombre_completo: string };
  terapeuta: { id: number; nombre_completo: string };
  sala: { id: number; nombre: string };
};

type AgendaDay = { fecha: string; total: number; dia_atencion: boolean };

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  const id = overrides.id ?? 1;
  return {
    id,
    folio: `CIT-2026-${String(id).padStart(6, '0')}`,
    estado: 'pendiente',
    fecha: '2026-10-20',
    hora_inicio: '09:00',
    hora_fin: '10:00',
    duracion_slots: 2,
    paciente: { id: id + 10, nombre_completo: `Paciente ${id}` },
    terapeuta: { id: 2, nombre_completo: 'Terapeuta Uno' },
    sala: { id: 3, nombre: 'Sala A' },
    ...overrides,
  };
}

let agendaCalls: URLSearchParams[] = [];

function setupApi({ citas = [], dias = [] }: { citas?: Appointment[]; dias?: AgendaDay[] }) {
  apiMock.mockImplementation((path: string) => {
    const url = String(path);

    if (url.startsWith('/api/agenda?')) {
      const params = new URLSearchParams(url.split('?')[1]);
      agendaCalls.push(params);
      const vista = params.get('vista') ?? 'semana';

      return Promise.resolve({
        data: {
          vista,
          fecha: params.get('fecha') ?? '2026-10-20',
          desde: '2026-10-19',
          hasta: '2026-10-25',
          ...(vista === 'mes' ? { dias } : { citas }),
        },
      });
    }

    if (url.startsWith('/api/terapeutas?')) {
      return Promise.resolve({ data: { items: [{ id: 2, nombre_completo: 'Terapeuta Uno' }] } });
    }

    if (url.startsWith('/api/salas?')) {
      return Promise.resolve({ data: { items: [{ id: 3, nombre: 'Sala A' }] } });
    }

    return Promise.reject(new Error(`Unexpected API request: ${url}`));
  });
}

async function renderAgenda() {
  const utils = render(<AgendaPage />);
  await waitFor(() => expect(agendaCalls.length).toBeGreaterThan(0));
  return utils;
}

describe('Agenda CP4-INT', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 12));
    apiMock.mockReset();
    pushMock.mockReset();
    agendaCalls = [];
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CP4-INT-01 muestra las citas programadas', async () => {
    setupApi({ citas: [appointment({ id: 1 }), appointment({ id: 2, hora_inicio: '11:00', hora_fin: '12:00' })] });

    await renderAgenda();

    expect(await screen.findByRole('button', { name: /Cita CIT-2026-000001/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Cita CIT-2026-000002/ })).toBeVisible();
  });

  it('CP4-INT-02 muestra la agenda vacía sin errores', async () => {
    setupApi({ citas: [] });

    const { container } = await renderAgenda();

    expect(container.querySelectorAll('.agenda-appointment')).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/0 citas en la vista seleccionada/)).toBeVisible();
  });

  it('CP4-INT-03/04/05 solicita la vista de día, semana y mes', async () => {
    setupApi({
      citas: [appointment()],
      dias: [{ fecha: '2026-10-20', total: 1, dia_atencion: true }],
    });

    await renderAgenda();
    expect(agendaCalls.at(-1)?.get('vista')).toBe('semana');

    const started = performance.now();
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    await waitFor(() => expect(agendaCalls.at(-1)?.get('vista')).toBe('dia'));
    expect(performance.now() - started).toBeLessThan(2000);

    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    await waitFor(() => expect(agendaCalls.at(-1)?.get('vista')).toBe('mes'));
    expect(performance.now() - started).toBeLessThan(4000);

    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    await waitFor(() => expect(agendaCalls.at(-1)?.get('vista')).toBe('semana'));
    expect(performance.now() - started).toBeLessThan(6000);
  });

  it('CP4-INT-06 completa cada cambio de vista en menos de 2 segundos', async () => {
    setupApi({ citas: [appointment()] });
    await renderAgenda();

    for (const vista of ['Día', 'Mes', 'Semana']) {
      const before = agendaCalls.length;
      const started = performance.now();
      fireEvent.click(screen.getByRole('button', { name: vista }));
      await waitFor(() => expect(agendaCalls.length).toBeGreaterThan(before));
      expect(performance.now() - started).toBeLessThan(2000);
    }
  });

  it('CP4-INT-07/08 muestra todas las citas simultáneas en carriles distintos (día y semana)', async () => {
    const citas = [
      appointment({ id: 1, paciente: { id: 11, nombre_completo: 'Paciente Uno' } }),
      appointment({
        id: 2,
        paciente: { id: 12, nombre_completo: 'Paciente Dos' },
        terapeuta: { id: 4, nombre_completo: 'Terapeuta Dos' },
        sala: { id: 5, nombre: 'Sala B' },
      }),
    ];
    setupApi({ citas });

    await renderAgenda();

    const primera = await screen.findByRole('button', { name: /Cita CIT-2026-000001/ });
    const segunda = screen.getByRole('button', { name: /Cita CIT-2026-000002/ });
    expect(primera).toHaveAttribute('data-lanes', '2');
    expect(segunda).toHaveAttribute('data-lanes', '2');
    expect(primera).toHaveAttribute('data-lane', '0');
    expect(segunda).toHaveAttribute('data-lane', '1');
    expect(primera).toHaveAccessibleName(/Sala A/);
    expect(segunda).toHaveAccessibleName(/Sala B/);
    expect(primera).toHaveAccessibleName(/Terapeuta Uno/);
    expect(segunda).toHaveAccessibleName(/Terapeuta Dos/);

    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    await waitFor(() => expect(agendaCalls.at(-1)?.get('vista')).toBe('dia'));
    expect(await screen.findByRole('button', { name: /Cita CIT-2026-000002/ })).toHaveAttribute(
      'data-lanes',
      '2',
    );
  });

  it('CP4-INT-09 la vista de mes indica el total de citas por día', async () => {
    setupApi({
      dias: [
        { fecha: '2026-10-19', total: 0, dia_atencion: true },
        { fecha: '2026-10-20', total: 3, dia_atencion: true },
      ],
    });
    await renderAgenda();

    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(await screen.findByText('3 citas')).toBeVisible();
  });

  it('CP4-INT-10 muestra un día con 24 citas sin perder ninguna', async () => {
    const citas = Array.from({ length: 24 }, (_, indice) => {
      const minutos = 7 * 60 + indice * 30;
      const hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
      const finMinutos = minutos + 30;
      const fin = `${String(Math.floor(finMinutos / 60)).padStart(2, '0')}:${String(finMinutos % 60).padStart(2, '0')}`;
      return appointment({
        id: indice + 1,
        hora_inicio: hora,
        hora_fin: fin,
        duracion_slots: 1,
      });
    });
    setupApi({ citas });

    const started = performance.now();
    const { container } = await renderAgenda();

    await waitFor(() => expect(container.querySelectorAll('.agenda-appointment')).toHaveLength(24));
    expect(performance.now() - started).toBeLessThan(3000);
  });

  it('CP4-INT-11 cada tarjeta muestra paciente, terapeuta, sala y horario', async () => {
    setupApi({ citas: [appointment()] });

    await renderAgenda();

    const tarjeta = await screen.findByRole('button', { name: /Cita CIT-2026-000001/ });
    expect(tarjeta).toHaveTextContent('Paciente 1');
    expect(tarjeta).toHaveTextContent('Terapeuta Uno');
    expect(tarjeta).toHaveTextContent('Sala A');
    expect(tarjeta).toHaveTextContent('09:00–10:00');
  });

  it('CP4-INT-12 respeta la duración de la cita como bloques contiguos', async () => {
    setupApi({
      citas: [
        appointment({ id: 1, hora_inicio: '09:00', hora_fin: '11:00', duracion_slots: 4 }),
      ],
    });

    await renderAgenda();

    const tarjeta = await screen.findByRole('button', { name: /Cita CIT-2026-000001/ });
    expect(tarjeta.style.gridRow).toContain('span 4');
    expect(tarjeta).toHaveTextContent('09:00–11:00');
  });

  it('CP4-INT-13 al abrir una tarjeta muestra el detalle de la cita', async () => {
    setupApi({
      citas: [appointment({ id: 1, paciente: { id: 11, nombre_completo: 'Lucía Solís' } })],
    });
    await renderAgenda();

    fireEvent.click(await screen.findByRole('button', { name: /Cita CIT-2026-000001/ }));

    const detalle = screen.getByText('Detalle de cita').closest('dialog') as HTMLDialogElement;
    expect(detalle).toHaveAttribute('open');
    expect(within(detalle).getByText(/Lucía Solís/)).toBeInTheDocument();
    expect(within(detalle).getByText(/Folio CIT-2026-000001/)).toBeInTheDocument();
  });

  it('CP4-INT-14 identifica la cita vencida por color, datos y leyenda sin texto dentro de la tarjeta', async () => {
    setupApi({
      citas: [
        appointment({
          id: 1,
          estado: 'vencida',
          fecha: '2026-10-19',
          paciente: { id: 11, nombre_completo: 'Paciente Vencido' },
        }),
      ],
    });

    await renderAgenda();

    const tarjeta = await screen.findByRole('button', { name: /Cita CIT-2026-000001/ });
    expect(tarjeta).toHaveAttribute('data-estado', 'vencida');
    expect(tarjeta).toHaveClass('agenda-appointment--vencida');
    expect(tarjeta).toHaveAccessibleName(/vencida/i);
    expect(tarjeta).not.toHaveTextContent(/vencida/i);
    expect(screen.getByRole('list', { name: 'Estados de las citas' })).toHaveTextContent(
      'Pendiente',
    );
    expect(screen.getByRole('list', { name: 'Estados de las citas' })).toHaveTextContent('Vencida');
  });

  it('CP4-INT-15 permite seleccionar una fecha específica', async () => {
    setupApi({ citas: [appointment()] });
    await renderAgenda();

    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-11-03' } });

    await waitFor(() => expect(agendaCalls.at(-1)?.get('fecha')).toBe('2026-11-03'));
  });

  it('CP4-INT-16 rechaza una fecha inválida sin cambiar la agenda', async () => {
    setupApi({ citas: [appointment()] });
    await renderAgenda();
    const llamadasIniciales = agendaCalls.length;

    fireEvent.change(screen.getByLabelText('Ir a fecha'), { target: { value: '31/02/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ir' }));

    expect(await screen.findByText(/AAAA-MM-DD|no es una fecha válida/i)).toBeVisible();
    expect(agendaCalls).toHaveLength(llamadasIniciales);
    expect(screen.getByRole('button', { name: /Cita CIT-2026-000001/ })).toBeVisible();
  });

  it('CP4-INT-17/18/19/20 muestra 24 lapsos, ocupados, libres y la cita de 18:30 con su duración', async () => {
    setupApi({
      citas: [
        appointment({ id: 1, hora_inicio: '09:00', hora_fin: '10:00', duracion_slots: 2 }),
        appointment({
          id: 2,
          folio: 'CIT-2026-000002',
          hora_inicio: '18:30',
          hora_fin: '19:00',
          duracion_slots: 1,
          paciente: { id: 12, nombre_completo: 'Paciente Último' },
        }),
      ],
    });
    await renderAgenda();

    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /2026-10-20 07:00 horario libre/ })).toHaveLength(1));

    const lapsos = screen.getAllByRole('button', { name: /2026-10-20 \d{2}:\d{2} (horario libre|cita ocupada)/ });
    expect(lapsos).toHaveLength(24);
    expect(screen.getByRole('button', { name: /2026-10-20 09:00 cita ocupada/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2026-10-20 10:00 horario libre/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2026-10-20 18:30 cita ocupada/ })).toBeInTheDocument();

    const extensa = screen.getByRole('button', { name: /Cita CIT-2026-000001/ });
    expect(extensa.style.gridRow).toContain('span 2');
    expect(screen.getByRole('button', { name: /Cita CIT-2026-000002/ })).toBeVisible();
  });

  it('CP4-INT-21 genera la lista de horarios en menos de 3 segundos', async () => {
    setupApi({ citas: [appointment()] });
    await renderAgenda();

    const started = performance.now();
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /2026-10-20 \d{2}:\d{2} (horario libre|cita ocupada)/ }),
      ).toHaveLength(24),
    );
    expect(performance.now() - started).toBeLessThan(3000);
  });

  it('CP4-INT-32 filtra la agenda por terapeuta', async () => {
    setupApi({ citas: [appointment()] });
    await renderAgenda();

    fireEvent.change(screen.getByLabelText('Terapeuta'), { target: { value: '2' } });

    await waitFor(() => expect(agendaCalls.at(-1)?.get('terapeuta_id')).toBe('2'));
  });

  it('CP4-INT-33 filtra la agenda por sala', async () => {
    setupApi({ citas: [appointment()] });
    await renderAgenda();

    fireEvent.change(screen.getByLabelText('Sala'), { target: { value: '3' } });

    await waitFor(() => expect(agendaCalls.at(-1)?.get('sala_id')).toBe('3'));
  });
});
