'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppointmentWizard,
  type AppointmentInitialValues,
} from '@/components/appointments/appointment-wizard';
import { AppFrame } from '@/components/app/app-frame';
import { AgendaToolbar, type AgendaView } from '@/components/agenda/agenda-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

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
type AgendaResponse = {
  vista: AgendaView;
  fecha: string;
  desde: string;
  hasta: string;
  citas?: Appointment[];
  dias?: AgendaDay[];
};
type Lookup = { id: number; nombre?: string; nombre_completo?: string };
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const parseDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const dateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date: string, days: number) => {
  const next = parseDate(date);
  next.setDate(next.getDate() + days);
  return dateString(next);
};
const weekStart = (date: string) => {
  const value = parseDate(date);
  const offset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - offset);
  return dateString(value);
};
const slotIndex = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return (hour * 60 + minute - 7 * 60) / 30;
};
const slotLabel = (index: number) => {
  const minutes = 7 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

export default function AgendaPage() {
  const router = useRouter();
  const [view, setView] = useState<AgendaView>('semana');
  const [date, setDate] = useState(today());
  const [therapistId, setTherapistId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [therapists, setTherapists] = useState<{ id: number; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: number; name: string }[]>([]);
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [draft, setDraft] = useState<AppointmentInitialValues | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ vista: view, fecha: date, privado: '0' });
      if (therapistId) params.set('terapeuta_id', therapistId);
      if (roomId) params.set('sala_id', roomId);
      try {
        const response = await api<AgendaResponse>(`/api/agenda?${params}`, { signal });
        setAgenda(response.data);
      } catch (cause) {
        if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [date, roomId, therapistId, view],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api<{ items: Lookup[] }>('/api/terapeutas?estado=activo&page=1&limit=100', {
        signal: controller.signal,
      }),
      api<{ items: Lookup[] }>('/api/salas?estado=activa&page=1&limit=100', {
        signal: controller.signal,
      }),
    ])
      .then(([therapistResponse, roomResponse]) => {
        setTherapists(
          therapistResponse.data.items.map((item) => ({
            id: item.id,
            name: item.nombre_completo ?? '',
          })),
        );
        setRooms(roomResponse.data.items.map((item) => ({ id: item.id, name: item.nombre ?? '' })));
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message);
      });
    return () => controller.abort();
  }, []);

  const days = useMemo(() => {
    if (!agenda) return [];
    if (view === 'dia') return [date];
    if (view === 'semana')
      return Array.from({ length: 7 }, (_, index) => addDays(weekStart(date), index));
    return [];
  }, [agenda, date, view]);
  const citas = agenda?.citas ?? [];
  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, Appointment[]>();
    citas.forEach((appointment) => {
      const dayAppointments = grouped.get(appointment.fecha) ?? [];
      dayAppointments.push(appointment);
      grouped.set(appointment.fecha, dayAppointments);
    });
    return grouped;
  }, [citas]);
  const occupiedSlotsByDay = useMemo(() => {
    const grouped = new Map<string, Set<number>>();
    citas.forEach((appointment) => {
      const occupied = grouped.get(appointment.fecha) ?? new Set<number>();
      const start = slotIndex(appointment.hora_inicio);
      for (let slot = start; slot < slotIndex(appointment.hora_fin); slot += 1) occupied.add(slot);
      grouped.set(appointment.fecha, occupied);
    });
    return grouped;
  }, [citas]);
  const dayCounts = new Map((agenda?.dias ?? []).map((day) => [day.fecha, day]));

  function navigate(direction: -1 | 1) {
    if (view === 'dia') setDate(addDays(date, direction));
    else if (view === 'semana') setDate(addDays(date, direction * 7));
    else {
      const next = parseDate(date);
      next.setMonth(next.getMonth() + direction, 1);
      setDate(dateString(next));
    }
  }

  function openSlot(day: string, slot: number) {
    const slotTime = slotLabel(slot);
    const matching = citas.find(
      (appointment) =>
        appointment.fecha === day &&
        slotIndex(appointment.hora_inicio) <= slot &&
        slot < slotIndex(appointment.hora_fin),
    );
    if (matching) {
      setDetail(matching);
      return;
    }
    setDraft({
      terapeuta_id: Number(therapistId) || 0,
      sala_id: Number(roomId) || 0,
      fecha: day,
      hora_inicio: slotTime,
      duracion_slots: 2,
    });
  }

  function openAppointment(appointment: Appointment) {
    setDetail(appointment);
  }

  const timeLine =
    view === 'dia' && date === today()
      ? (new Date().getHours() * 60 + new Date().getMinutes() - 420) / 30
      : null;

  return (
    <AppFrame>
      <main className="clinical-page agenda-page">
        <header className="clinical-heading">
          <div>
            <p className="eyebrow">PsicoGestión · Agenda clínica</p>
            <h1>Agenda</h1>
            <p className="module-description">Organización de citas por día, semana y mes.</p>
          </div>
          <Button
            onClick={() =>
              setDraft({
                terapeuta_id: Number(therapistId) || 0,
                sala_id: Number(roomId) || 0,
                fecha: date,
                hora_inicio: '',
                duracion_slots: 2,
              })
            }
          >
            Nueva cita
          </Button>
        </header>
        <AgendaToolbar
          date={date}
          onDateChange={setDate}
          onNavigate={navigate}
          onPrint={() =>
            router.push(
              `/agenda/imprimir?vista=${view}&fecha=${date}${therapistId ? `&terapeuta_id=${therapistId}` : ''}${roomId ? `&sala_id=${roomId}` : ''}`,
            )
          }
          onRoomChange={setRoomId}
          onTherapistChange={setTherapistId}
          onViewChange={setView}
          roomId={roomId}
          rooms={rooms}
          therapistId={therapistId}
          therapists={therapists}
          view={view}
        />
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="agenda-loading" aria-label="Cargando agenda">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} />
            ))}
          </div>
        ) : view === 'mes' ? (
          <div className="agenda-month" role="grid" aria-label="Calendario mensual de citas">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
              <span className="agenda-month-weekday" key={day}>
                {day}
              </span>
            ))}
            {(() => {
              const monthStart = parseDate(`${date.slice(0, 7)}-01`);
              const offset = (monthStart.getDay() + 6) % 7;
              const blanks = Array.from({ length: offset }, (_, index) => (
                <span aria-hidden="true" className="agenda-month-blank" key={`empty-${index}`} />
              ));
              const monthDays = agenda?.dias ?? [];
              return [
                ...blanks,
                ...monthDays.map((day) => (
                  <button
                    className={`agenda-month-day ${day.dia_atencion ? '' : 'non-attendance'}`}
                    key={day.fecha}
                    onClick={() => {
                      setDate(day.fecha);
                      setView('dia');
                    }}
                    type="button"
                  >
                    <span>{Number(day.fecha.slice(-2))}</span>
                    <Badge variant={day.total ? 'success' : 'default'}>{day.total} citas</Badge>
                  </button>
                )),
              ];
            })()}
          </div>
        ) : (
          <div className={`agenda-grid ${view === 'dia' ? 'agenda-grid-day' : 'agenda-grid-week'}`}>
            <div className="agenda-grid-corner" style={{ gridColumn: 1, gridRow: 1 }} />
            {days.map((day, dayIndex) => (
              <div
                className="agenda-day-heading"
                key={day}
                style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
              >
                {parseDate(day).toLocaleDateString('es-MX', {
                  weekday: view === 'dia' ? undefined : 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </div>
            ))}
            {Array.from({ length: 24 }, (_, slot) => (
              <time
                className="agenda-time-label"
                key={`time-${slot}`}
                style={{ gridColumn: 1, gridRow: slot + 2 }}
              >
                {slotLabel(slot)}
              </time>
            ))}
            {days.flatMap((day, dayIndex) =>
              Array.from({ length: 24 }, (_, slot) => {
                const isOccupied = occupiedSlotsByDay.get(day)?.has(slot) ?? false;
                return (
                  <button
                    aria-label={`${day} ${slotLabel(slot)} ${isOccupied ? 'cita ocupada' : 'horario libre'}`}
                    className="agenda-slot-hitarea"
                    key={`${day}-${slot}`}
                    onClick={() => openSlot(day, slot)}
                    style={{ gridColumn: dayIndex + 2, gridRow: slot + 2 }}
                    type="button"
                  />
                );
              }),
            )}
            {days.flatMap((day) =>
              (appointmentsByDay.get(day) ?? []).map((appointment) => {
                const dayColumn = days.indexOf(appointment.fecha) + 2;
                const startRow = slotIndex(appointment.hora_inicio) + 2;
                return (
                  <button
                    aria-label={`Cita ${appointment.folio}, ${appointment.paciente.nombre_completo}, ${appointment.terapeuta.nombre_completo}`}
                    className="agenda-appointment"
                    key={appointment.id}
                    onClick={() => openAppointment(appointment)}
                    style={{
                      gridColumn: dayColumn,
                      gridRow: `${startRow} / span ${appointment.duracion_slots}`,
                    }}
                    type="button"
                  >
                    <strong>
                      {appointment.hora_inicio}–{appointment.hora_fin}
                    </strong>
                    <span>{appointment.paciente.nombre_completo}</span>
                    <small>
                      {appointment.terapeuta.nombre_completo} · {appointment.sala.nombre}
                    </small>
                  </button>
                );
              }),
            )}
            {timeLine !== null && timeLine >= 0 && timeLine < 24 && (
              <span
                aria-label="Hora actual"
                className="agenda-current-time-line"
                style={{
                  gridColumn: 2,
                  gridRow: Math.floor(timeLine) + 2,
                  top: `${(timeLine % 1) * 100}%`,
                }}
              />
            )}
          </div>
        )}
      </main>
      <AppointmentWizard
        editing={null}
        initialValues={draft}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        onSaved={() => {
          setDraft(null);
          void load();
        }}
        open={draft !== null}
      />
      <Dialog
        description={detail ? `Folio ${detail.folio}` : undefined}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        open={detail !== null}
        title="Detalle de cita"
      >
        {detail && (
          <div className="agenda-detail">
            <p>
              <strong>Paciente:</strong> {detail.paciente.nombre_completo}
            </p>
            <p>
              <strong>Terapeuta:</strong> {detail.terapeuta.nombre_completo}
            </p>
            <p>
              <strong>Fecha:</strong> {detail.fecha} · {detail.hora_inicio}–{detail.hora_fin}
            </p>
            <p>
              <strong>Sala:</strong> {detail.sala.nombre}
            </p>
            <p>
              <strong>Estado:</strong> {detail.estado}
            </p>
            <Button
              onClick={() => router.push(`/citas?folio=${encodeURIComponent(detail.folio)}`)}
              variant="secondary"
            >
              Ir a citas
            </Button>
          </div>
        )}
      </Dialog>
      <span className="visually-hidden" aria-live="polite">
        {dayCounts.get(date)?.total ?? 0} citas en la fecha seleccionada.
      </span>
    </AppFrame>
  );
}
