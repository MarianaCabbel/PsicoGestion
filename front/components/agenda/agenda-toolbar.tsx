'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export type AgendaView = 'dia' | 'semana' | 'mes';
export type AgendaFilter = { id: number; name: string };

export function AgendaToolbar({
  view,
  date,
  therapistId,
  roomId,
  therapists,
  rooms,
  onViewChange,
  onDateChange,
  onTherapistChange,
  onRoomChange,
  onNavigate,
}: {
  view: AgendaView;
  date: string;
  therapistId: string;
  roomId: string;
  therapists: AgendaFilter[];
  rooms: AgendaFilter[];
  onViewChange: (view: AgendaView) => void;
  onDateChange: (date: string) => void;
  onTherapistChange: (id: string) => void;
  onRoomChange: (id: string) => void;
  onNavigate: (direction: -1 | 1) => void;
}) {
  return (
    <div className="agenda-toolbar" aria-label="Herramientas de agenda">
      <div className="agenda-toolbar-navigation">
        <Button aria-label="Periodo anterior" onClick={() => onNavigate(-1)} variant="secondary">
          ‹
        </Button>
        <Input
          label="Fecha"
          onChange={(event) => onDateChange(event.target.value)}
          type="date"
          value={date}
        />
        <Button aria-label="Periodo siguiente" onClick={() => onNavigate(1)} variant="secondary">
          ›
        </Button>
        <div className="agenda-view-select" role="group" aria-label="Vista de agenda">
          {(['dia', 'semana', 'mes'] as const).map((item) => (
            <Button
              aria-pressed={view === item}
              key={item}
              onClick={() => onViewChange(item)}
              variant={view === item ? 'primary' : 'secondary'}
            >
              {item === 'dia' ? 'Día' : item === 'semana' ? 'Semana' : 'Mes'}
            </Button>
          ))}
        </div>
      </div>
      <div className="agenda-toolbar-filters">
        <Select
          label="Terapeuta"
          onChange={(event) => onTherapistChange(event.target.value)}
          value={therapistId}
        >
          <option value="">Todos</option>
          {therapists.map((therapist) => (
            <option key={therapist.id} value={therapist.id}>
              {therapist.name}
            </option>
          ))}
        </Select>
        <Select label="Sala" onChange={(event) => onRoomChange(event.target.value)} value={roomId}>
          <option value="">Todas</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
