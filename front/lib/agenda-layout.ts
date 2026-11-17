/**
 * Utilidades de la agenda: rejilla de bloques de 30 minutos, carriles para citas
 * simultáneas y listas de horarios para la vista imprimible.
 */

/** La clínica atiende de 07:00 a 19:00: 24 bloques de 30 minutos. */
export const SLOT_COUNT = 24;
const MINUTOS_INICIO = 7 * 60;
const SLOT_MINUTOS = 30;

/** "08:30" -> 3. */
export function slotIndex(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour * 60 + minute - MINUTOS_INICIO) / SLOT_MINUTOS;
}

/** 3 -> "08:30". Acepta 24 para obtener el cierre de la jornada ("19:00"). */
export function slotLabel(index: number): string {
  const minutes = MINUTOS_INICIO + index * SLOT_MINUTOS;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export type AgendaPositioned = {
  id: number;
  hora_inicio: string;
  hora_fin: string;
};

export type LaneAssignment = {
  /** Índice del carril dentro del grupo de citas que se traslapan. */
  lane: number;
  /** Cantidad de carriles del grupo. */
  totalLanes: number;
};

/**
 * Asigna un carril a cada cita que comparte franja con otra. Las citas que se
 * traslapan de forma directa o transitiva forman un grupo y se reparten el ancho
 * de la columna; así ninguna queda oculta ni empalmada.
 */
export function assignLanes<T extends AgendaPositioned>(
  appointments: T[],
): Map<number, LaneAssignment> {
  const result = new Map<number, LaneAssignment>();
  if (appointments.length === 0) return result;

  const ordered = [...appointments].sort((left, right) => {
    const start = slotIndex(left.hora_inicio) - slotIndex(right.hora_inicio);
    if (start !== 0) return start;
    const end = slotIndex(left.hora_fin) - slotIndex(right.hora_fin);
    if (end !== 0) return end;
    return left.id - right.id;
  });

  let laneEnds: number[] = [];
  let group: { id: number; lane: number }[] = [];
  let groupEnd = Number.NEGATIVE_INFINITY;

  const closeGroup = () => {
    const totalLanes = Math.max(1, laneEnds.length);
    group.forEach((item) => result.set(item.id, { lane: item.lane, totalLanes }));
    laneEnds = [];
    group = [];
    groupEnd = Number.NEGATIVE_INFINITY;
  };

  ordered.forEach((appointment) => {
    const start = slotIndex(appointment.hora_inicio);
    const end = Math.max(start + 1, slotIndex(appointment.hora_fin));

    if (group.length > 0 && start >= groupEnd) closeGroup();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }

    group.push({ id: appointment.id, lane });
    groupEnd = Math.max(groupEnd, end);
  });

  closeGroup();
  return result;
}

export type DaySlot<T> = {
  slot: number;
  label: string;
  endLabel: string;
  occupied: boolean;
  appointments: T[];
};

/** Filas de 07:00 a 18:30 (última termina a las 19:00) con las citas que cubren cada una. */
export function buildDaySlots<T extends { hora_inicio: string; hora_fin: string }>(
  appointments: T[],
): DaySlot<T>[] {
  return Array.from({ length: SLOT_COUNT }, (_, slot) => {
    const covering = appointments.filter((appointment) => {
      const start = slotIndex(appointment.hora_inicio);
      const end = slotIndex(appointment.hora_fin);
      return start <= slot && slot < end;
    });

    return {
      slot,
      label: slotLabel(slot),
      endLabel: slotLabel(slot + 1),
      occupied: covering.length > 0,
      appointments: covering,
    };
  });
}
