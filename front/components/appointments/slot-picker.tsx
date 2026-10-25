'use client';

import { Button } from '@/components/ui/button';

export type AvailableStart = {
  hora_inicio: string;
  hora_fin: string;
  salas_libres: { id: number; nombre: string }[];
};

export function SlotPicker({
  starts,
  value,
  onChange,
  loading = false,
}: {
  starts: AvailableStart[];
  value: string;
  onChange: (start: AvailableStart) => void;
  loading?: boolean;
}) {
  if (loading) return <p role="status">Consultando horarios disponibles…</p>;
  if (starts.length === 0)
    return <p role="status">No hay horarios disponibles para esta selección.</p>;

  return (
    <div className="appointment-slots" role="group" aria-label="Horarios disponibles">
      {starts.map((start) => (
        <Button
          aria-pressed={value === start.hora_inicio}
          className="appointment-slot"
          key={start.hora_inicio}
          onClick={() => onChange(start)}
          type="button"
          variant={value === start.hora_inicio ? 'primary' : 'secondary'}
        >
          {start.hora_inicio}–{start.hora_fin}
        </Button>
      ))}
    </div>
  );
}
