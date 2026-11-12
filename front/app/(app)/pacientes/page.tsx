'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PatientForm, type PatientRecord } from '@/components/clinical/patient-form';
import { AppFrame } from '@/components/app/app-frame';
import { useSession } from '@/components/providers/session-provider';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import type { PatientPayload } from '@/lib/clinical-validation';

type PageResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  total_paginas: number;
};

type PatientAction = { patient: PatientRecord; action: 'baja' | 'reactivar' };
type ArcoPatient = Pick<PatientRecord, 'id' | 'nombre_completo' | 'anonimizado_at'>;

const PAGE_SIZE = 10;

export default function PacientesPage() {
  const { user } = useSession();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<'activo' | 'baja' | 'todos'>('activo');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<PatientRecord>>({
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
  const [editing, setEditing] = useState<PatientRecord | null>(null);
  const [pendingAction, setPendingAction] = useState<PatientAction | null>(null);
  const [arcoPatient, setArcoPatient] = useState<ArcoPatient | null>(null);
  const [anonymizationPhrase, setAnonymizationPhrase] = useState('');
  const [anonymizationConfirmed, setAnonymizationConfirmed] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadPatients = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        q: debouncedQuery,
        estado: status,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      try {
        const response = await api<PageResult<PatientRecord>>(`/api/pacientes?${params}`, {
          signal,
        });
        if (response.data.total_paginas < page) {
          setPage(Math.max(1, response.data.total_paginas));
          return;
        }
        setResult(response.data);
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el directorio.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [debouncedQuery, page, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadPatients(controller.signal);
    return () => controller.abort();
  }, [loadPatients]);

  async function savePatient(values: PatientPayload, isEditing: boolean) {
    const { acepta_aviso, ...payload } = values;
    setSaving(true);
    try {
      if (isEditing && editing) {
        await api<PatientRecord>(`/api/pacientes/${editing.id}`, {
          method: 'PUT',
          body: payload,
        });
        toast.success('Paciente actualizado.');
      } else {
        const response = await api<PatientRecord>('/api/pacientes', {
          method: 'POST',
          body: payload,
        });
        if (acepta_aviso) {
          try {
            await api(`/api/pacientes/${response.data.id}/consentimiento`, {
              method: 'POST',
              body: { aceptado: true },
            });
          } catch (cause) {
            toast.error(
              `El paciente se registró, pero no pudimos registrar el consentimiento: ${
                cause instanceof Error ? cause.message : 'error desconocido'
              }`,
            );
            setFormOpen(false);
            setEditing(null);
            await loadPatients();
            return;
          }
        }
        toast.success('Paciente registrado y consentimiento guardado.');
      }
      setFormOpen(false);
      setEditing(null);
      await loadPatients();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar el paciente.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmPatientAction() {
    if (!pendingAction) return;
    const { patient, action } = pendingAction;
    setSaving(true);
    try {
      if (action === 'baja') {
        await api(`/api/pacientes/${patient.id}`, {
          method: 'DELETE',
          body: { confirmar: true },
        });
        toast.success('Paciente dado de baja.');
      } else {
        await api(`/api/pacientes/${patient.id}/reactivar`, { method: 'POST' });
        toast.success('Paciente reactivado.');
      }
      setPendingAction(null);
      await loadPatients();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado.');
    } finally {
      setSaving(false);
    }
  }

  async function exportPatientData(patient: PatientRecord) {
    setExportingId(patient.id);
    try {
      const response = await api<Record<string, unknown>>(`/api/pacientes/${patient.id}/exportar`);
      const file = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `paciente-${patient.id}-datos.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success('Se descargó la exportación de datos.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudieron exportar los datos.');
    } finally {
      setExportingId(null);
    }
  }

  async function anonymizePatient() {
    if (!arcoPatient || anonymizationPhrase !== 'ANONIMIZAR') return;
    setAnonymizing(true);
    try {
      await api(`/api/pacientes/${arcoPatient.id}/anonimizar`, {
        method: 'POST',
        body: { confirmar: true, confirmacion: anonymizationPhrase },
      });
      toast.success('Expediente anonimizado; las citas se conservaron para estadística.');
      setArcoPatient(null);
      setAnonymizationPhrase('');
      await loadPatients();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo anonimizar el expediente.');
    } finally {
      setAnonymizing(false);
    }
  }

  const columns: DataColumn<PatientRecord>[] = [
    {
      key: 'nombre',
      header: 'Paciente',
      render: (patient) => <strong>{patient.nombre_completo}</strong>,
    },
    {
      key: 'curp',
      header: 'CURP',
      render: (patient) => <span className="clinical-mono">{patient.curp}</span>,
    },
    {
      key: 'contacto',
      header: 'Contacto',
      render: (patient) => (
        <span>
          {patient.telefono}
          <br />
          <small>{patient.correo ?? 'Sin correo'}</small>
        </span>
      ),
    },
    {
      key: 'nacimiento',
      header: 'Nacimiento',
      render: (patient) => (
        <span>
          {patient.fecha_nacimiento.slice(0, 10)}
          <br />
          <small>
            {patient.sexo === 'H' ? 'Hombre' : patient.sexo === 'M' ? 'Mujer' : 'No especificado'}
          </small>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (patient) => (
        <span className={`clinical-status clinical-status--${patient.estado}`}>
          {patient.anonimizado_at ? 'Anonimizado' : patient.estado === 'activo' ? 'Activo' : 'Baja'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (patient) => {
        const items: ActionMenuItem[] = [
          {
            label: exportingId === patient.id ? 'Exportando…' : 'Exportar datos',
            onSelect: () => void exportPatientData(patient),
            disabled: exportingId === patient.id,
          },
        ];
        if (user?.rol === 'administrador' && !patient.anonimizado_at) {
          items.push({
            label: 'Anonimizar',
            onSelect: () => setArcoPatient(patient),
            variant: 'danger',
          });
        }
        if (patient.estado === 'activo') {
          items.push(
            {
              label: 'Editar',
              onSelect: () => {
                setEditing(patient);
                setFormOpen(true);
              },
            },
            {
              label: 'Dar de baja',
              onSelect: () => setPendingAction({ patient, action: 'baja' }),
              variant: 'danger',
            },
          );
        } else if (user?.rol === 'administrador' && !patient.anonimizado_at) {
          items.push({
            label: 'Reactivar',
            onSelect: () => setPendingAction({ patient, action: 'reactivar' }),
          });
        }
        if (items.length === 0) {
          return <span className="clinical-muted">Solo administración</span>;
        }
        return <ActionMenu items={items} label={`Acciones para ${patient.nombre_completo}`} />;
      },
    },
  ];

  return (
    <AppFrame>
      <div className="clinical-page">
        <header className="clinical-heading">
          <div>
            <p className="eyebrow">Directorio clínico</p>
            <h2>Pacientes</h2>
            <p className="clinical-subtitle">Consulta y administra los expedientes de pacientes.</p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Registrar paciente
          </Button>
        </header>
        <section aria-label="Filtros de pacientes" className="clinical-filters">
          <Input
            label="Buscar pacientes"
            name="patient-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, CURP o teléfono"
            type="search"
            value={query}
          />
          <Select
            label="Estado"
            name="patient-status"
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
            value={status}
          >
            <option value="activo">Activos</option>
            <option value="baja">Baja</option>
            <option value="todos">Todos</option>
          </Select>
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
            debouncedQuery
              ? 'Prueba con otro nombre, CURP o teléfono.'
              : 'Cuando registres un paciente, aparecerá aquí.'
          }
          emptyTitle={debouncedQuery ? 'No encontramos coincidencias' : 'Aún no hay pacientes'}
          getRowId={(patient) => patient.id}
          loading={loading}
          rows={result.items}
        />
        <nav aria-label="Paginación de pacientes" className="clinical-pagination">
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
        description={
          editing
            ? 'Actualiza los datos personales del expediente.'
            : 'Completa los datos y registra el consentimiento del aviso de privacidad.'
        }
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        open={formOpen}
        size="lg"
        title={editing ? 'Editar paciente' : 'Nuevo paciente'}
      >
        <PatientForm
          busy={saving}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSave={savePatient}
          patient={editing}
        />
      </Dialog>
      <ConfirmDialog
        busy={saving}
        confirmLabel={pendingAction?.action === 'reactivar' ? 'Reactivar' : 'Dar de baja'}
        description={
          pendingAction?.action === 'reactivar'
            ? `¿Deseas reactivar el expediente de ${pendingAction.patient.nombre_completo}?`
            : `La baja es lógica y conserva el expediente. ¿Confirmas dar de baja a ${pendingAction?.patient.nombre_completo}?`
        }
        onConfirm={() => void confirmPatientAction()}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        open={pendingAction !== null}
        title={
          pendingAction?.action === 'reactivar' ? 'Confirmar reactivación' : 'Confirmar baja lógica'
        }
      />
      <ConfirmDialog
        confirmLabel="Continuar"
        description={
          arcoPatient
            ? `Se eliminarán los datos identificables de ${arcoPatient.nombre_completo}. Las citas se conservarán sin datos identificables y no habrá citas pendientes futuras. Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={() => setAnonymizationConfirmed(true)}
        onOpenChange={(open) => {
          if (!open && !anonymizationConfirmed) {
            setArcoPatient(null);
            setAnonymizationPhrase('');
          }
        }}
        open={arcoPatient !== null && !anonymizationConfirmed}
        title="Confirmar solicitud de anonimización"
      />
      <Dialog
        description="Para completar la anonimización escribe exactamente ANONIMIZAR. Las citas futuras pendientes impiden esta acción."
        onOpenChange={(open) => {
          if (!open) {
            setArcoPatient(null);
            setAnonymizationConfirmed(false);
            setAnonymizationPhrase('');
          }
        }}
        open={arcoPatient !== null && anonymizationConfirmed}
        title="Confirmación final de seguridad"
      >
        <Input
          autoComplete="off"
          id="patient-anonymization-confirmation"
          label="Escribe ANONIMIZAR"
          onChange={(event) => setAnonymizationPhrase(event.target.value)}
          value={anonymizationPhrase}
        />
        <div className="ui-dialog-actions">
          <Button
            disabled={anonymizing}
            onClick={() => {
              setArcoPatient(null);
              setAnonymizationPhrase('');
            }}
            variant="secondary"
          >
            Cancelar
          </Button>
          <Button
            disabled={anonymizing || anonymizationPhrase !== 'ANONIMIZAR'}
            onClick={() => void anonymizePatient()}
            variant="danger"
          >
            {anonymizing ? 'Anonimizando…' : 'Anonimizar expediente'}
          </Button>
        </div>
      </Dialog>
    </AppFrame>
  );
}
