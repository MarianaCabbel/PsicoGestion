'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppFrame } from '@/components/app/app-frame';
import { TherapistForm, type TherapistRecord } from '@/components/clinical/therapist-form';
import { useSession } from '@/components/providers/session-provider';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api, apiBlob, ApiError } from '@/lib/api';
import {
  affectedAppointmentFolios,
  type ScheduleBlock,
  type TherapistPayload,
} from '@/lib/clinical-validation';

type TherapistPage = {
  items: TherapistRecord[];
  page: number;
  limit: number;
  total: number;
  total_paginas: number;
};

type PendingSchedule = {
  therapistId: number;
  therapistName: string;
  blocks: ScheduleBlock[];
  folios: string[];
};

type TherapistAction = { therapist: TherapistRecord; action: 'baja' | 'reactivar' };

const PAGE_SIZE = 12;

function foliosAffected(error: unknown): string[] | null {
  if (!(error instanceof ApiError)) return null;
  return affectedAppointmentFolios(error.status, error.details);
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('es-MX') ?? '')
    .join('');
}

function TherapistPhoto({ therapist }: { therapist: TherapistRecord }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!therapist.tiene_foto) {
      setPhotoUrl(null);
      return;
    }

    setPhotoUrl(null);
    const controller = new AbortController();
    let objectUrl: string | null = null;
    void apiBlob(`/api/terapeutas/${therapist.id}/foto`, { signal: controller.signal })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) return;
        toast.error(
          error instanceof Error
            ? `No se pudo cargar la foto de ${therapist.nombre_completo}: ${error.message}`
            : 'No se pudo cargar la foto del terapeuta.',
        );
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [therapist.id, therapist.nombre_completo, therapist.tiene_foto]);

  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={`Foto de ${therapist.nombre_completo}`}
      className="therapist-avatar-image"
      src={photoUrl}
    />
  ) : (
    <span
      aria-label={`Iniciales de ${therapist.nombre_completo}`}
      className="therapist-avatar-fallback"
    >
      {initials(therapist.nombre_completo)}
    </span>
  );
}

export default function TerapeutasPage() {
  const { user } = useSession();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'activo' | 'baja' | 'todos'>('activo');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<TherapistPage>({
    items: [],
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    total_paginas: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TherapistRecord | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [pendingSchedule, setPendingSchedule] = useState<PendingSchedule | null>(null);
  const [pendingAction, setPendingAction] = useState<TherapistAction | null>(null);

  const loadTherapists = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        q: query.trim(),
        estado: status,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      try {
        const response = await api<TherapistPage>(`/api/terapeutas?${params}`, { signal });
        setResult(response.data);
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError(
          cause instanceof Error ? cause.message : 'No se pudo cargar el equipo terapéutico.',
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, query, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadTherapists(controller.signal);
    return () => controller.abort();
  }, [loadTherapists]);

  async function openEditForm(therapist: TherapistRecord) {
    setSaving(true);
    try {
      const response = await api<TherapistRecord>(`/api/terapeutas/${therapist.id}`);
      setEditing(response.data);
      setFormSession((value) => value + 1);
      setFormOpen(true);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo cargar el perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function saveTherapist(
    values: TherapistPayload,
    photo: File | null,
    schedule: ScheduleBlock[],
    isEditing: boolean,
  ) {
    setSaving(true);
    let savedTherapist: TherapistRecord | null = null;
    try {
      if (isEditing && editing) {
        const response = await api<TherapistRecord>(`/api/terapeutas/${editing.id}`, {
          method: 'PUT',
          body: values,
        });
        savedTherapist = response.data;
      } else {
        const response = await api<TherapistRecord>('/api/terapeutas', {
          method: 'POST',
          body: values,
        });
        savedTherapist = response.data;
      }

      if (photo && savedTherapist) {
        const formData = new FormData();
        formData.append('foto', photo);
        await api(`/api/terapeutas/${savedTherapist.id}/foto`, {
          method: 'PUT',
          body: formData,
        });
        savedTherapist.tiene_foto = true;
      }

      if (!savedTherapist) throw new Error('La API no devolvió el terapeuta guardado.');
      await api(`/api/terapeutas/${savedTherapist.id}/horarios`, {
        method: 'PUT',
        body: { horarios: schedule },
      });

      toast.success(isEditing ? 'Perfil y horario actualizados.' : 'Terapeuta registrado.');
      setFormOpen(false);
      setEditing(null);
      await loadTherapists();
    } catch (cause) {
      const folios = foliosAffected(cause);
      if (folios && savedTherapist) {
        setFormOpen(false);
        setEditing(null);
        setPendingSchedule({
          therapistId: savedTherapist.id,
          therapistName: savedTherapist.nombre_completo,
          blocks: schedule,
          folios,
        });
        toast.warning('El perfil se guardó, pero el horario requiere confirmar citas afectadas.');
        await loadTherapists();
        return;
      }
      const message = cause instanceof Error ? cause.message : 'No se pudo guardar el terapeuta.';
      toast.error(
        savedTherapist
          ? `El perfil quedó guardado, pero una operación adicional falló: ${message}`
          : message,
      );
      if (savedTherapist) {
        setFormOpen(false);
        setEditing(null);
        await loadTherapists();
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmScheduleChange() {
    if (!pendingSchedule) return;
    setSaving(true);
    try {
      await api(`/api/terapeutas/${pendingSchedule.therapistId}/horarios`, {
        method: 'PUT',
        body: { horarios: pendingSchedule.blocks, confirmar_conflictos: true },
      });
      toast.success('Horario actualizado. Revisa y reprograma las citas notificadas.');
      setPendingSchedule(null);
      await loadTherapists();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo confirmar el horario.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmTherapistAction() {
    if (!pendingAction) return;
    const { therapist, action } = pendingAction;
    setSaving(true);
    try {
      if (action === 'baja') {
        await api(`/api/terapeutas/${therapist.id}`, {
          method: 'DELETE',
          body: { confirmar: true },
        });
        toast.success('Terapeuta dado de baja.');
      } else {
        await api(`/api/terapeutas/${therapist.id}/reactivar`, { method: 'POST' });
        toast.success('Terapeuta reactivado.');
      }
      setPendingAction(null);
      await loadTherapists();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado.');
    } finally {
      setSaving(false);
    }
  }

  const columns: DataColumn<TherapistRecord>[] = [
    {
      key: 'terapeuta',
      header: 'Terapeuta',
      render: (therapist) => (
        <span className="table-identity">
          <span className="table-identity-avatar">
            <TherapistPhoto therapist={therapist} />
          </span>
          <span>
            <strong>{therapist.nombre_completo}</strong>
            <small>ID #{therapist.id}</small>
          </span>
        </span>
      ),
    },
    {
      key: 'cedula',
      header: 'Cédula',
      render: (therapist) => (
        <span className="clinical-mono">{therapist.cedula_profesional}</span>
      ),
    },
    {
      key: 'contacto',
      header: 'Contacto',
      render: (therapist) => (
        <span className="table-contact">
          {therapist.telefono}
          <small>{therapist.correo}</small>
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (therapist) => (
        <Badge variant={therapist.estado === 'activo' ? 'success' : 'warning'}>
          {therapist.estado === 'activo' ? 'Activo' : 'Baja'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (therapist) => {
        const items: ActionMenuItem[] = [];
        if (therapist.estado === 'activo') {
          items.push(
            {
              label: 'Editar perfil y horario',
              onSelect: () => void openEditForm(therapist),
              disabled: saving,
            },
            {
              label: 'Dar de baja',
              onSelect: () => setPendingAction({ therapist, action: 'baja' }),
              variant: 'danger',
              disabled: saving,
            },
          );
        } else if (user?.rol === 'administrador') {
          items.push({
            label: 'Reactivar',
            onSelect: () => setPendingAction({ therapist, action: 'reactivar' }),
            disabled: saving,
          });
        }
        if (items.length === 0) {
          return <span className="clinical-muted">Solo administración puede reactivar</span>;
        }
        return <ActionMenu items={items} label={`Acciones para ${therapist.nombre_completo}`} />;
      },
    },
  ];

  return (
    <AppFrame>
      <div className="clinical-page">
        <header className="clinical-heading">
          <div>
            <h2>Terapeutas</h2>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormSession((value) => value + 1);
              setFormOpen(true);
            }}
          >
            Registrar terapeuta
          </Button>
        </header>

        <section aria-label="Filtros de terapeutas" className="clinical-filters therapist-filters">
          <Input
            label="Buscar terapeutas"
            name="therapist-search"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Nombre, correo o cédula"
            type="search"
            value={query}
          />
          <label className="ui-field">
            <span className="ui-label">Estado</span>
            <select
              className="ui-select"
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPage(1);
              }}
              value={status}
            >
              <option value="activo">Activos</option>
              <option value="baja">Baja</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <p aria-live="polite" className="clinical-result-count">
            {result.total} resultados
          </p>
        </section>
        {error && (
          <p className="clinical-error" role="alert">
            {error}
          </p>
        )}

        <DataTable
          columns={columns}
          emptyDescription={
            query
              ? 'Prueba con otro nombre, correo o número de cédula.'
              : 'Registra el primer perfil del equipo terapéutico.'
          }
          emptyTitle={query ? 'No encontramos coincidencias' : 'Aún no hay terapeutas'}
          getRowId={(therapist) => therapist.id}
          loading={loading}
          rows={result.items}
        />

        <nav aria-label="Paginación de terapeutas" className="clinical-pagination">
          <Button
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => current - 1)}
            variant="secondary"
          >
            Anterior
          </Button>
          <span aria-live="polite">
            Página {page} de {result.total_paginas}
          </span>
          <Button
            disabled={loading || page >= result.total_paginas}
            onClick={() => setPage((current) => current + 1)}
            variant="secondary"
          >
            Siguiente
          </Button>
        </nav>
      </div>

      <Dialog
        description="Completa los datos profesionales, una foto opcional y los bloques de atención semanales."
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        open={formOpen}
        size="lg"
        title={editing ? 'Editar terapeuta' : 'Nuevo terapeuta'}
      >
        <TherapistForm
          busy={saving}
          key={formSession}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSave={saveTherapist}
          therapist={editing}
        />
      </Dialog>

      <Dialog
        description={`El nuevo horario de ${pendingSchedule?.therapistName ?? 'este terapeuta'} afecta ${
          pendingSchedule?.folios.length ?? 0
        } citas pendientes. Al confirmar, deberás reprogramarlas.`}
        onOpenChange={(open) => {
          if (!open) setPendingSchedule(null);
        }}
        open={pendingSchedule !== null}
        title="Confirmar cambio de horario"
      >
        <div className="schedule-conflict-list">
          <p>Folios afectados:</p>
          <ul>
            {pendingSchedule?.folios.map((folio) => (
              <li key={folio}>{folio}</li>
            ))}
          </ul>
        </div>
        <div className="ui-dialog-actions">
          <Button disabled={saving} onClick={() => setPendingSchedule(null)} variant="secondary">
            Cancelar cambio
          </Button>
          <Button disabled={saving} onClick={() => void confirmScheduleChange()} variant="danger">
            {saving ? 'Actualizando…' : 'Confirmar horario'}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        busy={saving}
        confirmLabel={pendingAction?.action === 'reactivar' ? 'Reactivar' : 'Dar de baja'}
        description={
          pendingAction?.action === 'reactivar'
            ? `¿Deseas reactivar el perfil de ${pendingAction.therapist.nombre_completo}?`
            : `La baja es lógica y conserva el historial. ¿Confirmas dar de baja a ${pendingAction?.therapist.nombre_completo}?`
        }
        onConfirm={() => void confirmTherapistAction()}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        open={pendingAction !== null}
        title={
          pendingAction?.action === 'reactivar' ? 'Confirmar reactivación' : 'Confirmar baja lógica'
        }
      />
    </AppFrame>
  );
}
