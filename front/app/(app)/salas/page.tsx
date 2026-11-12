'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { AppFrame } from '@/components/app/app-frame';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
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
    estado_dia: 'libre' | 'reservada';
  }[];
};
type MonthAvailability = {
  sala: { id: number; nombre: string };
  dias: {
    fecha: string;
    dia_atencion: boolean;
    slots_ocupados: number;
    estado: 'libre' | 'reservada';
    nivel: 'libre' | 'parcial' | 'completa';
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
  const [editing, setEditing] = useState<Room | null>(null);
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [pendingAction, setPendingAction] = useState<RoomAction | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<number | ''>('');
  const [view, setView] = useState<'list' | 'availability'>('list');
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

  function openCreate() {
    setError('');
    setEditing(null);
    setName('');
    setFieldError('');
    setSaveError('');
    setDialogOpen(true);
  }

  function openEdit(room: Room) {
    setEditing(room);
    setName(room.nombre);
    setFieldError('');
    setSaveError('');
    setDialogOpen(true);
  }

  function closeEditor() {
    setDialogOpen(false);
    setEditing(null);
    setName('');
    setFieldError('');
    setSaveError('');
  }

  /** Mensaje por campo que devuelve el backend (por ejemplo, nombre duplicado). */
  function nombreInvalido(cause: unknown): string {
    if (!cause || typeof cause !== 'object' || !('details' in cause)) return '';
    const { details } = cause as { details?: unknown };
    if (!details || typeof details !== 'object' || !('errors' in details)) return '';
    return (details as { errors?: Record<string, string> }).errors?.nombre ?? '';
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFieldError('');
    setSaveError('');
    try {
      await api<Room>(editing ? `/api/salas/${editing.id}` : '/api/salas', {
        method: editing ? 'PUT' : 'POST',
        body: { nombre: name.trim().replace(/\s+/g, ' ') },
      });
      toast.success(editing ? 'Sala actualizada correctamente.' : 'Sala creada correctamente.');
      closeEditor();
      await loadRooms();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo guardar la sala.';
      const invalido = nombreInvalido(cause);
      if (invalido) setFieldError(invalido);
      else setSaveError(message);
      toast.error(message);
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

  const columns: DataColumn<Room>[] = [
    {
      key: 'sala',
      header: 'Sala',
      render: (room) => (
        <span className="table-identity">
          <span>
            <strong>{room.nombre}</strong>
            <small>Sala #{room.id}</small>
          </span>
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (room) => (
        <Badge variant={room.estado === 'activa' ? 'success' : 'default'}>{room.estado}</Badge>
      ),
    },
    {
      key: 'citas_hoy',
      header: 'Citas de hoy',
      render: (room) => room.citas_hoy,
    },
    {
      key: 'estado_actual',
      header: 'Estado actual',
      render: (room) => (room.ocupada_ahora ? 'Ocupada ahora' : 'Libre ahora'),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (room) => {
        const items: ActionMenuItem[] = [
          {
            label: 'Ver disponibilidad',
            onSelect: () => {
              setSelectedRoom(room.id);
              const date = parseLocalDate(selectedDate);
              setMonthDate(new Date(date.getFullYear(), date.getMonth(), 1));
              setView('availability');
            },
          },
        ];
        if (room.estado === 'activa') {
          items.push(
            { label: 'Editar', onSelect: () => openEdit(room) },
            {
              label: 'Dar de baja',
              onSelect: () => setPendingAction({ room }),
              variant: 'danger',
              disabled: saving,
            },
          );
        }
        return <ActionMenu items={items} label={`Acciones para ${room.nombre}`} />;
      },
    },
  ];

  return (
    <AppFrame>
      <main className="clinical-page">
        <header className="clinical-heading">
          <div>
            <h1>Salas</h1>
          </div>
          {view === 'list' && (
            <div className="clinical-actions">
              <div className="room-filter-inline">
                <Select
                  label="Filtrar salas"
                  onChange={(event) => setStatus(event.target.value)}
                  value={status}
                >
                  <option value="activa">Activas</option>
                  <option value="baja">Baja</option>
                  <option value="todas">Todas</option>
                </Select>
              </div>
              <Button onClick={openCreate}>Nueva sala</Button>
            </div>
          )}
        </header>

        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        {view === 'list' ? (
          <DataTable
            columns={columns}
            emptyDescription="Registra una sala para administrar su agenda."
            emptyTitle="Aún no hay salas"
            getRowId={(room) => room.id}
            loading={loading}
            rows={rooms}
          />
        ) : (
          <>
            <div className="room-back-row">
              <Button variant="secondary" onClick={() => setView('list')}>
                <ArrowLeft size={18} aria-hidden="true" /> Regresar
              </Button>
            </div>

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
              {selectedRoomDay && (
                <div className="room-day-grid">
                  <Card className="room-day-card" key={selectedRoomDay.id}>
                    <div className="room-card-heading">
                      <h3>{selectedRoomDay.nombre}</h3>
                      <Badge variant={selectedRoomDay.estado_dia === 'reservada' ? 'warning' : 'success'}>
                        {selectedRoomDay.estado_dia === 'reservada' ? 'Reservada' : 'Libre'}
                      </Badge>
                    </div>
                    <p>{selectedRoomDay.libres} bloques libres</p>
                    <div className="room-slot-grid" aria-label={`Ocupación de ${selectedRoomDay.nombre}`}>
                      {Array.from({ length: dayAvailability.num_slots }, (_, slot) => {
                        const hour = 7 * 60 + slot * 30;
                        const label = `${String(Math.floor(hour / 60)).padStart(2, '0')}:${String(hour % 60).padStart(2, '0')}`;
                        const occupied = selectedRoomDay.ocupados.includes(slot);
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
                </div>
              )}
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
                          className={`room-calendar-day ${day.nivel === 'completa' ? 'reservada' : day.nivel} ${day.dia_atencion ? '' : 'non-attendance'}`}
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
                    <span className="parcial">Reservada (parcial)</span>
                    <span className="reservada">Reservada (día completo)</span>
                  </div>
                </>
              )
            )}
          </section>
        )}
          </>
        )}
      </main>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (open) setDialogOpen(true);
          else closeEditor();
        }}
        size="sm"
        title={editing ? 'Editar sala' : 'Registrar sala'}
        description="El nombre debe ser único (normalizado) y tener como máximo 10 caracteres."
      >
        <form className="ui-form" onSubmit={(event) => void saveRoom(event)}>
          <Input
            autoFocus
            error={fieldError || undefined}
            id="room-name"
            label="Nombre de sala"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
          {saveError && (
            <p className="alert error" role="alert">
              {saveError}
            </p>
          )}
          <div className="ui-dialog-actions">
            <Button onClick={closeEditor} variant="secondary">
              Cerrar
            </Button>
            <Button disabled={saving || !name.trim()} type="submit">
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear sala'}
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
