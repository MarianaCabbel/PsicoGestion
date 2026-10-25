'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { AppFrame } from '@/components/app/app-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

type Room = {
  id: number;
  nombre: string;
  estado: string;
  citas_hoy: number;
  ocupada_ahora: boolean;
};
type PageResult = { items: Room[]; total: number; total_paginas: number };
type DayAvailability = {
  fecha: string;
  dia_atencion: boolean;
  num_slots: number;
  salas: {
    id: number;
    nombre: string;
    ocupados: number[];
    horas_ocupadas: string[];
    libres: number;
  }[];
};
type MonthAvailability = {
  sala: { id: number; nombre: string };
  dias: {
    fecha: string;
    dia_atencion: boolean;
    slots_ocupados: number;
    estado: 'libre' | 'parcial' | 'reservada';
  }[];
};
type RoomAction = { room: Room };

const PAGE_SIZE = 100;
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseLocalDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function SalasPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [status, setStatus] = useState('activa');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [pendingAction, setPendingAction] = useState<RoomAction | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState(localDate(new Date()));
  const [monthDate, setMonthDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [dayAvailability, setDayAvailability] = useState<DayAvailability | null>(null);
  const [monthAvailability, setMonthAvailability] = useState<MonthAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const monthRange = useMemo(
    () => ({
      desde: localDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)),
      hasta: localDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)),
    }),
    [monthDate],
  );

  const loadRooms = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ estado: status, page: '1', limit: String(PAGE_SIZE) });
        const response = await api<PageResult>(`/api/salas?${params}`, { signal });
        setRooms(response.data.items);
      } catch (cause) {
        if (cause instanceof Error && cause.name !== 'AbortError') {
          setError(cause.message || 'No se pudieron cargar las salas.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadRooms(controller.signal);
    return () => controller.abort();
  }, [loadRooms]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ fecha: selectedDate });
    void api<DayAvailability>(`/api/salas/disponibilidad?${params}`, { signal: controller.signal })
      .then((response) => setDayAvailability(response.data))
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message);
      });
    return () => controller.abort();
  }, [selectedDate]);

  useEffect(() => {
    if (selectedRoom === '') {
      setMonthAvailability(null);
      return;
    }
    const controller = new AbortController();
    setAvailabilityLoading(true);
    const params = new URLSearchParams(monthRange);
    void api<MonthAvailability>(`/api/salas/${selectedRoom}/disponibilidad?${params}`, {
      signal: controller.signal,
    })
      .then((response) => setMonthAvailability(response.data))
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false);
      });
    return () => controller.abort();
  }, [monthRange, selectedRoom]);

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api<Room>('/api/salas', {
        method: 'POST',
        body: { nombre: name.trim().replace(/\s+/g, ' ') },
      });
      toast.success('Sala creada correctamente.');
      setDialogOpen(false);
      setName('');
      await loadRooms();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la sala.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRoom() {
    if (!pendingAction) return;
    setSaving(true);
    setError('');
    try {
      await api(`/api/salas/${pendingAction.room.id}`, {
        method: 'DELETE',
        body: { confirmar: true },
      });
      toast.success('Sala dada de baja.');
      setPendingAction(null);
      if (selectedRoom === pendingAction.room.id) setSelectedRoom('');
      await loadRooms();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo dar de baja la sala.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const selectedRoomDay = dayAvailability?.salas.find((room) => room.id === selectedRoom);
  const firstWeekday = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const calendarCells = [...Array(firstWeekday).fill(null), ...(monthAvailability?.dias ?? [])];

  return (
    <AppFrame>
      <main className="clinical-page">
        <header className="clinical-heading">
          <div>
            <p className="eyebrow">PsicoGestión · Administración</p>
            <h1>Salas</h1>
            <p className="module-description">
              Estado en tiempo real y disponibilidad de los espacios de atención.
            </p>
          </div>
          <div className="clinical-actions">
            <Select
              label="Filtrar salas"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="activa">Activas</option>
              <option value="baja">Baja</option>
              <option value="todas">Todas</option>
            </Select>
            <Button
              onClick={() => {
                setError('');
                setDialogOpen(true);
              }}
            >
              Nueva sala
            </Button>
          </div>
        </header>

        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="room-card-grid" aria-label="Cargando salas">
            {[1, 2, 3].map((item) => (
              <Skeleton className="room-skeleton" key={item} />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <EmptyState
            title="Aún no hay salas"
            description="Registra una sala para administrar su agenda."
            action={<Button onClick={() => setDialogOpen(true)}>Crear sala</Button>}
          />
        ) : (
          <div className="room-card-grid">
            {rooms.map((room) => (
              <Card className="room-card" key={room.id}>
                <div className="room-card-heading">
                  <div>
                    <h2>{room.nombre}</h2>
                    <p>Sala #{room.id}</p>
                  </div>
                  <Badge variant={room.estado === 'activa' ? 'success' : 'default'}>
                    {room.estado}
                  </Badge>
                </div>
                <dl className="room-status">
                  <div>
                    <dt>Citas de hoy</dt>
                    <dd>{room.citas_hoy}</dd>
                  </div>
                  <div>
                    <dt>Estado actual</dt>
                    <dd>{room.ocupada_ahora ? 'Ocupada ahora' : 'Libre ahora'}</dd>
                  </div>
                </dl>
                <div className="room-card-actions">
                  <Button
                    onClick={() => {
                      setSelectedRoom(room.id);
                      const date = parseLocalDate(selectedDate);
                      setMonthDate(new Date(date.getFullYear(), date.getMonth(), 1));
                    }}
                    variant="secondary"
                  >
                    Ver disponibilidad
                  </Button>
                  {room.estado === 'activa' && (
                    <Button
                      disabled={saving}
                      onClick={() => setPendingAction({ room })}
                      variant="danger"
                    >
                      Dar de baja
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <section className="room-availability" aria-labelledby="room-day-heading">
          <div className="room-section-heading">
            <div>
              <p className="eyebrow">Agenda</p>
              <h2 id="room-day-heading">Disponibilidad por día</h2>
            </div>
            <Input
              label="Fecha de disponibilidad"
              onChange={(event) => setSelectedDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
          </div>
          {dayAvailability && (
            <>
              {!dayAvailability.dia_atencion && (
                <p className="alert">La clínica no atiende este día.</p>
              )}
              <div className="room-day-grid">
                {dayAvailability.salas.map((room) => (
                  <Card className="room-day-card" key={room.id}>
                    <h3>{room.nombre}</h3>
                    <p>{room.libres} bloques libres</p>
                    <div className="room-slot-grid" aria-label={`Ocupación de ${room.nombre}`}>
                      {Array.from({ length: dayAvailability.num_slots }, (_, slot) => {
                        const hour = 7 * 60 + slot * 30;
                        const label = `${String(Math.floor(hour / 60)).padStart(2, '0')}:${String(hour % 60).padStart(2, '0')}`;
                        const occupied = room.ocupados.includes(slot);
                        return (
                          <span
                            className={occupied ? 'room-slot occupied' : 'room-slot free'}
                            key={slot}
                            title={`${label}: ${occupied ? 'reservada' : 'libre'}`}
                            aria-label={`${label}: ${occupied ? 'reservada' : 'libre'}`}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>

        {selectedRoom !== '' && (
          <section className="room-month" aria-labelledby="room-month-heading">
            <div className="room-section-heading">
              <div>
                <p className="eyebrow">{monthAvailability?.sala.nombre ?? 'Sala seleccionada'}</p>
                <h2 id="room-month-heading">Calendario mensual</h2>
              </div>
              <div className="room-month-controls">
                <Button
                  aria-label="Mes anterior"
                  onClick={() =>
                    setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))
                  }
                  variant="secondary"
                >
                  ‹
                </Button>
                <strong>
                  {monthDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                </strong>
                <Button
                  aria-label="Mes siguiente"
                  onClick={() =>
                    setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))
                  }
                  variant="secondary"
                >
                  ›
                </Button>
              </div>
            </div>
            {availabilityLoading ? (
              <Skeleton className="room-calendar-skeleton" />
            ) : (
              monthAvailability && (
                <>
                  <div
                    className="room-calendar"
                    role="grid"
                    aria-label="Disponibilidad mensual de la sala"
                  >
                    {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day) => (
                      <span className="room-calendar-weekday" key={day}>
                        {day}
                      </span>
                    ))}
                    {calendarCells.map((day, index) =>
                      day ? (
                        <button
                          aria-label={`${day.fecha}, ${day.estado}`}
                          aria-pressed={day.fecha === selectedDate}
                          className={`room-calendar-day ${day.estado} ${day.dia_atencion ? '' : 'non-attendance'}`}
                          key={day.fecha}
                          onClick={() => setSelectedDate(day.fecha)}
                          type="button"
                        >
                          {Number(day.fecha.slice(-2))}
                        </button>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="room-calendar-blank"
                          key={`blank-${index}`}
                        />
                      ),
                    )}
                  </div>
                  <div className="room-calendar-legend">
                    <span className="libre">Libre</span>
                    <span className="parcial">Parcial</span>
                    <span className="reservada">Reservada</span>
                  </div>
                </>
              )
            )}
          </section>
        )}
      </main>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Registrar sala"
        description="El nombre debe ser único (normalizado) y tener como máximo 10 caracteres."
      >
        <form className="ui-form" onSubmit={(event) => void createRoom(event)}>
          <Input
            autoFocus
            id="room-name"
            label="Nombre de sala"
            maxLength={10}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
          <div className="ui-dialog-actions">
            <Button onClick={() => setDialogOpen(false)} variant="secondary">
              Cerrar
            </Button>
            <Button disabled={saving || !name.trim()} type="submit">
              {saving ? 'Guardando…' : 'Crear sala'}
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title="Dar de baja la sala"
        description="La operación se rechazará si hay citas futuras asociadas."
        confirmLabel="Confirmar baja"
        busy={saving}
        onConfirm={() => void deleteRoom()}
      />
      {selectedRoomDay && (
        <span className="visually-hidden" aria-live="polite">
          {selectedRoomDay.nombre}: {selectedRoomDay.libres} bloques libres el {selectedDate}.
        </span>
      )}
    </AppFrame>
  );
}
