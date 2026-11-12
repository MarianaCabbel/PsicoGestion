'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppointmentWizard } from '@/components/appointments/appointment-wizard';
import { AppFrame } from '@/components/app/app-frame';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { anunciarCambioDeCitas } from '@/lib/citas-events';

type Lookup = { id: number; nombre: string; nombre_completo?: string };
type Appointment = {
  id: number;
  folio: string;
  estado: 'pendiente' | 'cancelada' | 'vencida';
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_slots: number;
  paciente: { id: number; nombre_completo: string; telefono?: string };
  terapeuta: { id: number; nombre_completo: string };
  sala: { id: number; nombre: string };
  paciente_tiene_correo?: boolean;
  notificacion?: { estado: string; intentos: number; enviada_at: string | null } | null;
};
type PageResult = { items: Appointment[]; page: number; total: number; total_paginas: number };
type CancelTarget = { appointment: Appointment; byFolio: boolean };

const PAGE_SIZE = 50;

export default function CitasPage() {
  return (
    <Suspense fallback={null}>
      <CitasPageContent />
    </Suspense>
  );
}

function CitasPageContent() {
  const searchParams = useSearchParams();
  const folioParam = (searchParams.get('folio') ?? '').trim().toUpperCase();
  const [tab, setTab] = useState<'pendiente' | 'cancelada' | 'vencida' | 'todas'>('pendiente');
  const [rooms, setRooms] = useState<Lookup[]>([]);
  const [therapists, setTherapists] = useState<Lookup[]>([]);
  const [roomId, setRoomId] = useState('');
  const [therapistId, setTherapistId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [untilDate, setUntilDate] = useState('');
  const [folioQuery, setFolioQuery] = useState(() => folioParam);
  const [folioMode, setFolioMode] = useState(() => Boolean(folioParam));
  const [result, setResult] = useState<PageResult>({
    items: [],
    page: 1,
    total: 0,
    total_paginas: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api<{ items: Lookup[] }>('/api/salas?estado=activa&page=1&limit=100', {
        signal: controller.signal,
      }),
      api<{ items: Lookup[] }>('/api/terapeutas?estado=activo&page=1&limit=100', {
        signal: controller.signal,
      }),
    ])
      .then(([roomResponse, therapistResponse]) => {
        setRooms(roomResponse.data.items);
        setTherapists(therapistResponse.data.items);
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message);
      });
    return () => controller.abort();
  }, []);

  const loadAppointments = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        estado: tab,
        page: String(page),
        limit: String(PAGE_SIZE),
        orden: 'asc',
      });
      if (roomId) params.set('sala_id', roomId);
      if (therapistId) params.set('terapeuta_id', therapistId);
      if (fromDate) params.set('desde', fromDate);
      if (untilDate) params.set('hasta', untilDate);
      try {
        const response = await api<PageResult>(`/api/citas?${params}`, { signal });
        setResult(response.data);
      } catch (cause) {
        if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [fromDate, page, roomId, tab, therapistId, untilDate],
  );

  useEffect(() => {
    if (folioMode) return;
    const controller = new AbortController();
    void loadAppointments(controller.signal);
    return () => controller.abort();
  }, [folioMode, loadAppointments]);

  /** Carga una cita por folio; comparte la lógica con la búsqueda manual. */
  const buscarPorFolio = useCallback(async (folio: string, signal?: AbortSignal) => {
    if (!folio) {
      setFolioMode(false);
      setDetail(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api<Appointment>(`/api/citas/folio/${encodeURIComponent(folio)}`, {
        signal,
      });
      setDetail(response.data);
      setResult({ items: [response.data], page: 1, total: 1, total_paginas: 1 });
      setFolioMode(true);
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setDetail(null);
      setError(cause instanceof Error ? cause.message : 'No se encontró el folio.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  // Enlace directo desde la agenda: /citas?folio=...
  useEffect(() => {
    if (!folioParam) return;
    setFolioQuery(folioParam);
    void buscarPorFolio(folioParam);
  }, [buscarPorFolio, folioParam]);

  async function searchFolio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await buscarPorFolio(folioQuery.trim().toUpperCase());
  }

  async function openDetails(appointment: Appointment) {
    setError('');
    try {
      const response = await api<Appointment>(
        `/api/citas/folio/${encodeURIComponent(appointment.folio)}`,
      );
      setDetail(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar el detalle.');
    }
  }

  async function cancelAppointment() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      const path = cancelTarget.byFolio
        ? `/api/citas/folio/${encodeURIComponent(cancelTarget.appointment.folio)}/cancelar`
        : `/api/citas/${cancelTarget.appointment.id}/cancelar`;
      await api(path, { method: 'POST', body: { confirmar: true } });
      toast.success(`Cita ${cancelTarget.appointment.folio} cancelada.`);
      anunciarCambioDeCitas();
      setCancelTarget(null);
      if (detail?.id === cancelTarget.appointment.id) setDetail(null);
      await loadAppointments();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo cancelar la cita.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation(appointment: Appointment) {
    setBusy(true);
    try {
      await api(`/api/citas/${appointment.id}/reenviar-confirmacion`, { method: 'POST' });
      toast.success('Confirmación encolada para reenvío.');
      await openDetails(appointment);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo reenviar la confirmación.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function editAppointment(appointment: Appointment) {
    setEditing(appointment);
    setWizardOpen(true);
  }

  function createAppointment() {
    setEditing(null);
    setWizardOpen(true);
  }

  const notificationLabel = (notification?: Appointment['notificacion']) => {
    if (!notification) return 'Sin confirmación registrada';
    if (notification.estado === 'enviada')
      return `Enviado ${notification.enviada_at ? new Date(notification.enviada_at).toLocaleString('es-MX') : ''}`;
    if (notification.estado === 'fallida') return `Fallido (${notification.intentos} intentos)`;
    return `${notification.estado} (${notification.intentos} intentos)`;
  };

  return (
    <AppFrame>
      <main className="clinical-page">
        <header className="clinical-heading">
          <div>
            <p className="eyebrow">PsicoGestión · Agenda</p>
            <h1>Citas</h1>
            <p className="module-description">
              Agenda, modifica y consulta las notificaciones de confirmación.
            </p>
          </div>
          <Button onClick={createAppointment}>Agendar cita</Button>
        </header>

        <form className="appointment-folio-search" onSubmit={(event) => void searchFolio(event)}>
          <Input
            id="appointment-folio"
            label="Buscar folio"
            onChange={(event) => setFolioQuery(event.target.value)}
            placeholder="CIT-AAAA-000000"
            value={folioQuery}
          />
          <Button type="submit">Buscar</Button>
          {folioMode && (
            <Button
              onClick={() => {
                setFolioMode(false);
                setFolioQuery('');
                setDetail(null);
                setPage(1);
              }}
              variant="secondary"
            >
              Limpiar búsqueda
            </Button>
          )}
        </form>

        <div className="appointment-filters">
          <Select
            label="Sala"
            onChange={(event) => {
              setFolioMode(false);
              setRoomId(event.target.value);
              setPage(1);
            }}
            value={roomId}
          >
            <option value="">Todas las salas</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.nombre}
              </option>
            ))}
          </Select>
          <Select
            label="Terapeuta"
            onChange={(event) => {
              setFolioMode(false);
              setTherapistId(event.target.value);
              setPage(1);
            }}
            value={therapistId}
          >
            <option value="">Todos los terapeutas</option>
            {therapists.map((therapist) => (
              <option key={therapist.id} value={therapist.id}>
                {therapist.nombre_completo}
              </option>
            ))}
          </Select>
          <Input
            label="Desde"
            onChange={(event) => {
              setFolioMode(false);
              setFromDate(event.target.value);
              setPage(1);
            }}
            type="date"
            value={fromDate}
          />
          <Input
            label="Hasta"
            onChange={(event) => {
              setFolioMode(false);
              setUntilDate(event.target.value);
              setPage(1);
            }}
            type="date"
            value={untilDate}
          />
        </div>

        <div className="appointment-tabs" role="tablist" aria-label="Filtrar citas por estado">
          {(['pendiente', 'cancelada', 'vencida', 'todas'] as const).map((state) => {
            const label =
              state === 'pendiente'
                ? 'Pendientes'
                : state === 'cancelada'
                  ? 'Canceladas'
                  : state === 'vencida'
                    ? 'Vencidas'
                    : 'Todas';
            return (
              <button
                aria-selected={tab === state}
                className={tab === state ? 'active' : ''}
                key={state}
                onClick={() => {
                  setFolioMode(false);
                  setTab(state);
                  setPage(1);
                  setDetail(null);
                }}
                role="tab"
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="appointment-loading" aria-label="Cargando citas">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} />
            ))}
          </div>
        ) : result.items.length === 0 ? (
          <EmptyState
            title="Sin citas"
            description="No hay citas para los filtros seleccionados."
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="appointment-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha y hora</th>
                    <th>Paciente</th>
                    <th>Terapeuta</th>
                    <th className="appointment-col-sala">Sala</th>
                    <th>Estado</th>
                    <th className="appointment-col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((appointment) => (
                    <tr key={appointment.id}>
                      <td data-label="Folio">
                        <button
                          className="folio-copy"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(appointment.folio)
                              .then(() => toast.success('Folio copiado.'))
                              .catch(() => toast.error('No se pudo copiar el folio.'));
                          }}
                          title="Copiar folio"
                          type="button"
                        >
                          {appointment.folio}
                        </button>
                      </td>
                      <td data-label="Fecha y hora">
                        {appointment.fecha.slice(0, 10)} · {appointment.hora_inicio}–
                        {appointment.hora_fin}
                      </td>
                      <td data-label="Paciente">{appointment.paciente.nombre_completo}</td>
                      <td data-label="Terapeuta">{appointment.terapeuta.nombre_completo}</td>
                      <td className="appointment-col-sala" data-label="Sala">{appointment.sala.nombre}</td>
                      <td data-label="Estado">
                        <Badge
                          variant={
                            appointment.estado === 'pendiente'
                              ? 'success'
                              : appointment.estado === 'cancelada'
                                ? 'danger'
                                : 'default'
                          }
                        >
                          {appointment.estado}
                        </Badge>
                      </td>
                      <td className="appointment-row-actions" data-label="Acciones">
                        <ActionMenu
                          items={[
                            {
                              label: 'Detalle',
                              onSelect: () => void openDetails(appointment),
                            },
                            ...(appointment.estado === 'pendiente'
                              ? [
                                  {
                                    label: 'Modificar',
                                    onSelect: () => editAppointment(appointment),
                                  },
                                  {
                                    label: 'Cancelar',
                                    onSelect: () => setCancelTarget({ appointment, byFolio: false }),
                                    variant: 'danger' as const,
                                  },
                                ]
                              : []),
                          ]}
                          label={`Acciones para ${appointment.folio}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!folioMode && (
              <div className="appointment-pagination">
                <span>
                  {result.total} citas · página {result.page} de {result.total_paginas}
                </span>
                <div>
                  <Button
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    variant="secondary"
                  >
                    Anterior
                  </Button>
                  <Button
                    disabled={page >= result.total_paginas}
                    onClick={() => setPage((current) => current + 1)}
                    variant="secondary"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {detail && (
          <section className="appointment-detail" aria-labelledby="appointment-detail-title">
            <div className="room-section-heading">
              <div>
                <p className="eyebrow">Detalle de cita</p>
                <h2 id="appointment-detail-title">{detail.folio}</h2>
              </div>
              <Button aria-label="Cerrar detalle" onClick={() => setDetail(null)} variant="ghost">
                Cerrar
              </Button>
            </div>
            <dl className="appointment-summary">
              <div>
                <dt>Paciente</dt>
                <dd>{detail.paciente.nombre_completo}</dd>
              </div>
              <div>
                <dt>Terapeuta</dt>
                <dd>{detail.terapeuta.nombre_completo}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>
                  {detail.fecha.slice(0, 10)} · {detail.hora_inicio}–{detail.hora_fin}
                </dd>
              </div>
              <div>
                <dt>Sala</dt>
                <dd>{detail.sala.nombre}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{detail.estado}</dd>
              </div>
              <div>
                <dt>Correo de confirmación</dt>
                <dd>{notificationLabel(detail.notificacion)}</dd>
              </div>
            </dl>
            <div className="clinical-actions">
              {detail.estado === 'pendiente' && (
                <Button
                  disabled={busy || !detail.paciente_tiene_correo}
                  onClick={() => void resendConfirmation(detail)}
                  variant="secondary"
                >
                  Reenviar confirmación
                </Button>
              )}
              {detail.estado === 'pendiente' && (
                <Button onClick={() => editAppointment(detail)} variant="secondary">
                  Modificar
                </Button>
              )}
              {detail.estado === 'pendiente' && (
                <Button
                  onClick={() => setCancelTarget({ appointment: detail, byFolio: true })}
                  variant="danger"
                >
                  Cancelar por folio
                </Button>
              )}
            </div>
            {detail.paciente_tiene_correo === false && (
              <p className="form-help">El paciente no tiene correo registrado.</p>
            )}
          </section>
        )}
      </main>

      <AppointmentWizard
        editing={editing}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) setEditing(null);
        }}
        onSaved={() => {
          anunciarCambioDeCitas();
          void loadAppointments();
          setDetail(null);
        }}
        open={wizardOpen}
      />
      {cancelTarget && (
        <ConfirmDialog
          busy={busy}
          confirmLabel="Cancelar cita"
          description={`Se cancelará la cita ${cancelTarget.appointment.folio}. Esta acción libera el horario reservado.`}
          onConfirm={() => void cancelAppointment()}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
          open
          title="Confirmar cancelación"
        />
      )}
    </AppFrame>
  );
}

