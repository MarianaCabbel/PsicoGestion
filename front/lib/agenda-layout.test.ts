import { describe, expect, it } from 'vitest';
import { assignLanes, buildDaySlots, SLOT_COUNT, slotIndex, slotLabel } from './agenda-layout';

const cita = (id: number, hora_inicio: string, hora_fin: string) => ({ id, hora_inicio, hora_fin });

describe('agenda layout', () => {
  it('divide la jornada en 24 lapsos de 30 minutos de 07:00 a 19:00', () => {
    expect(SLOT_COUNT).toBe(24);
    expect(slotIndex('07:00')).toBe(0);
    expect(slotIndex('18:30')).toBe(23);
    expect(slotLabel(0)).toBe('07:00');
    expect(slotLabel(23)).toBe('18:30');
    expect(slotLabel(24)).toBe('19:00');
  });

  it('no crea carriles cuando las citas no se traslapan', () => {
    const lanes = assignLanes([
      cita(1, '09:00', '10:00'),
      cita(2, '10:00', '11:00'),
      cita(3, '11:30', '12:00'),
    ]);

    expect(lanes.get(1)).toEqual({ lane: 0, totalLanes: 1 });
    expect(lanes.get(2)).toEqual({ lane: 0, totalLanes: 1 });
    expect(lanes.get(3)).toEqual({ lane: 0, totalLanes: 1 });
  });

  it('reparte en dos carriles las citas simultáneas en salas y terapeutas distintos', () => {
    const lanes = assignLanes([cita(1, '09:00', '10:00'), cita(2, '09:00', '10:00')]);

    expect(lanes.get(1)).toEqual({ lane: 0, totalLanes: 2 });
    expect(lanes.get(2)).toEqual({ lane: 1, totalLanes: 2 });
  });

  it('agrupa traslapes transitivos y separa el siguiente grupo', () => {
    const lanes = assignLanes([
      cita(1, '09:00', '10:30'),
      cita(2, '09:30', '11:00'),
      cita(3, '10:30', '11:30'),
      cita(4, '13:00', '14:00'),
    ]);

    // En 10:30 solo coinciden las citas 2 y 3: dos carriles bastan y el 0 se reutiliza.
    expect(lanes.get(1)).toEqual({ lane: 0, totalLanes: 2 });
    expect(lanes.get(2)).toEqual({ lane: 1, totalLanes: 2 });
    expect(lanes.get(3)).toEqual({ lane: 0, totalLanes: 2 });
    expect(lanes.get(4)).toEqual({ lane: 0, totalLanes: 1 });
  });

  it('construye los 24 horarios e identifica ocupados y libres', () => {
    const slots = buildDaySlots([
      cita(1, '09:00', '10:00'),
      cita(2, '18:30', '19:00'),
    ]);

    expect(slots).toHaveLength(24);
    expect(slots[0]).toMatchObject({ label: '07:00', endLabel: '07:30', occupied: false });
    expect(slots[4]).toMatchObject({ label: '09:00', occupied: true });
    expect(slots[5]).toMatchObject({ label: '09:30', occupied: true });
    expect(slots[6]).toMatchObject({ label: '10:00', occupied: false });
    expect(slots[23]).toMatchObject({ label: '18:30', endLabel: '19:00', occupied: true });
  });

  it('deja todos los lapsos libres cuando el día no tiene citas', () => {
    const slots = buildDaySlots([]);

    expect(slots).toHaveLength(24);
    expect(slots.every((slot) => !slot.occupied && slot.appointments.length === 0)).toBe(true);
  });
});
