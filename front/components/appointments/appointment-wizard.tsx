'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiError, api } from '@/lib/api';
import { SlotPicker, type AvailableStart } from './slot-picker';

type LookupItem = { id: number; nombre_completo?: string; nombre?: string };
type Appointment = {
  id: number;
  folio: string;
  fecha: string;
  hora_inicio: string;
  duracion_slots: number;
  paciente: { id: number; nombre_completo: string };
  terapeuta: { id: number; nombre_completo: string };
  sala: { id: number; nombre: string };
};
type WizardValues = {
  paciente_id: number;
  terapeuta_id: number;
  sala_id: number;
  fecha: string;
  hora_inicio: string;
  duracion_slots: number;
};
export type AppointmentInitialValues = Partial<WizardValues>;

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function AppointmentWizard({
  open,
  onOpenChange,
  editing,
  initialValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Appointment | null;
  initialValues?: AppointmentInitialValues | null;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [patients, setPatients] = useState<LookupItem[]>([]);
  const [therapists, setTherapists] = useState<LookupItem[]>([]);
  const [values, setValues] = useState<WizardValues>({
    paciente_id: 0,
    terapeuta_id: 0,
    sala_id: 0,
    fecha: today(),
    hora_inicio: '',
    duracion_slots: 1,
  });
  const [selectedRoomName, setSelectedRoomName] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [starts, setStarts] = useState<AvailableStart[]>([]);
  const [selectionUnavailable, setSelectionUnavailable] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadAvailability, setReloadAvailability] = useState(0);

  const filteredPatients = useMemo(() => {
    const query = patientQuery.trim().toLocaleLowerCase();
    return patients.filter((patient) =>
      (patient.nombre_completo ?? '').toLocaleLowerCase().includes(query),
    );
  }, [patientQuery, patients]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void Promise.all([
      api<{ items: LookupItem[] }>('/api/pacientes?estado=activo&page=1&limit=100', {
        signal: controller.signal,
      }),
      api<{ items: LookupItem[] }>('/api/terapeutas?estado=activo&page=1&limit=100', {
        signal: controller.signal,
      }),
    ])
      .then(([patientResponse, therapistResponse]) => {
        setPatients(patientResponse.data.items);
        setTherapists(therapistResponse.data.items);
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== 'AbortError') {
          setError(cause.message || 'No se pudieron cargar pacientes y terapeutas.');
        }
      });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setValues({
        paciente_id: editing.paciente.id,
        terapeuta_id: editing.terapeuta.id,
        sala_id: editing.sala.id,
        fecha: editing.fecha.slice(0, 10),
        hora_inicio: editing.hora_inicio,
        duracion_slots: editing.duracion_slots,
      });
      setSelectedRoomName(editing.sala.nombre);
      setPatientQuery(editing.paciente.nombre_completo);
    } else {
      setValues({
        paciente_id: initialValues?.paciente_id ?? 0,
        terapeuta_id: initialValues?.terapeuta_id ?? 0,
        sala_id: initialValues?.sala_id ?? 0,
        fecha: initialValues?.fecha ?? today(),
        hora_inicio: initialValues?.hora_inicio ?? '',
        duracion_slots: initialValues?.duracion_slots ?? 2,
      });
      setSelectedRoomName('');
      setPatientQuery('');
    }
    setStep(0);
    setError('');
  }, [editing, initialValues, open]);

  useEffect(() => {
    if (!open || !values.terapeuta_id || !values.fecha || (step < 3 && !editing)) {
      setStarts([]);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      fecha: values.fecha,
      terapeuta_id: String(values.terapeuta_id),
      paciente_id: String(values.paciente_id || ''),
      duracion_slots: String(values.duracion_slots),
    });
    if (editing) params.set('excluir_cita_id', String(editing.id));
    setAvailabilityLoading(true);
    void api<{ inicios: AvailableStart[] }>(`/api/citas/disponibilidad?${params}`, {
      signal: controller.signal,
    })
      .then((response) => {
        setStarts(response.data.inicios);
        const selectedRoom = response.data.inicios
          .find((start) => start.hora_inicio === values.hora_inicio)
          ?.salas_libres.find((room) => room.id === values.sala_id);
        if (selectedRoom) setSelectedRoomName(selectedRoom.nombre);
        setSelectionUnavailable(
          Boolean(values.hora_inicio) &&
            !response.data.inicios.some((start) => start.hora_inicio === values.hora_inicio),
        );
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== 'AbortError') {
          setError(cause.message || 'No se pudo consultar la disponibilidad.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false);
      });
    return () => controller.abort();
  }, [
    editing,
    open,
    reloadAvailability,
    step,
    values.duracion_slots,
    values.fecha,
    values.paciente_id,
    values.terapeuta_id,
    values.hora_inicio,
    values.sala_id,
  ]);

  const change = useCallback(<K extends keyof WizardValues>(key: K, value: WizardValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === 'paciente_id' || key === 'terapeuta_id' || key === 'fecha') {
      setValues((current) => ({ ...current, hora_inicio: '', sala_id: 0 }));
      setSelectedRoomName('');
      setSelectionUnavailable(false);
    }
    if (key === 'sala_id' && value === 0) setSelectedRoomName('');
    if (key === 'hora_inicio') setSelectionUnavailable(false);
    setError('');
  }, []);

  function nextStep() {
    if (step === 0 && !values.paciente_id)
      return setError('Selecciona un paciente para continuar.');
    if (step === 1 && !values.terapeuta_id)
      return setError('Selecciona un terapeuta para continuar.');
    if (step === 2 && !values.fecha) return setError('Selecciona una fecha para continuar.');
    if (step === 3 && (!values.hora_inicio || !values.sala_id)) {
      return setError('Selecciona un horario disponible y una sala.');
    }
    if (step === 3 && selectionUnavailable) {
      return setError(
        'El horario seleccionado ya no está disponible. Elige uno de los horarios actualizados.',
      );
    }
    setError('');
    setStep((current) => Math.min(current + 1, 4));
  }

  async function submit() {
    setLoading(true);
    setError('');
    try {
      await api<Appointment>(editing ? `/api/citas/${editing.id}` : '/api/citas', {
        method: editing ? 'PUT' : 'POST',
        body: values,
      });
      toast.success(editing ? 'Cita modificada correctamente.' : 'Cita agendada correctamente.');
      onOpenChange(false);
      onSaved();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo guardar la cita.';
      if (cause instanceof ApiError && cause.status === 409) {
        setError(
          `${message} Se actualizó la disponibilidad; conserva y revisa los datos antes de reintentar.`,
        );
        toast.error(message);
        setReloadAvailability((current) => current + 1);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  const currentPatient = patients.find((item) => item.id === values.paciente_id);
  const currentTherapist = therapists.find((item) => item.id === values.terapeuta_id);
  const selectedStart = starts.find((start) => start.hora_inicio === values.hora_inicio);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Modificar cita ${editing.folio}` : 'Agendar cita'}
      description="Completa los cinco pasos para reservar un horario."
    >
      <div className="appointment-step-indicator" aria-label={`Paso ${step + 1} de 5`}>
        {['Paciente', 'Terapeuta', 'Fecha', 'Horario', 'Confirmación'].map((label, index) => (
          <span aria-current={step === index ? 'step' : undefined} key={label}>
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <div className="ui-form">
          <Input
            id="appointment-patient-search"
            label="Buscar paciente"
            onChange={(event) => setPatientQuery(event.target.value)}
            placeholder="Nombre del paciente"
            value={patientQuery}
          />
          <Select
            id="appointment-patient"
            label="Paciente"
            onChange={(event) => change('paciente_id', Number(event.target.value))}
            value={String(values.paciente_id)}
          >
            <option value="0">Seleccionar paciente</option>
            {filteredPatients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.nombre_completo}
              </option>
            ))}
          </Select>
        </div>
      )}
      {step === 1 && (
        <div className="ui-form">
          <Select
            id="appointment-therapist"
            label="Terapeuta"
            onChange={(event) => change('terapeuta_id', Number(event.target.value))}
            value={String(values.terapeuta_id)}
          >
            <option value="0">Seleccionar terapeuta</option>
            {therapists.map((therapist) => (
              <option key={therapist.id} value={therapist.id}>
                {therapist.nombre_completo}
              </option>
            ))}
          </Select>
        </div>
      )}
      {step === 2 && (
        <div className="ui-form">
          <Input
            id="appointment-date"
            label="Fecha de la cita"
            min={today()}
            onChange={(event) => change('fecha', event.target.value)}
            type="date"
            value={values.fecha}
          />
        </div>
      )}
      {step === 3 && (
        <div className="ui-form">
          <Select
            id="appointment-duration"
            label="Duración"
            onChange={(event) => {
              change('duracion_slots', Number(event.target.value));
              change('hora_inicio', '');
              change('sala_id', 0);
            }}
            value={String(values.duracion_slots)}
          >
            {[1, 2, 3, 4].map((duration) => (
              <option key={duration} value={duration}>
                {duration} {duration === 1 ? 'bloque (30 min)' : `bloques (${duration * 30} min)`}
              </option>
            ))}
          </Select>
          <SlotPicker
            loading={availabilityLoading}
            onChange={(start) => {
              change('hora_inicio', start.hora_inicio);
              const room = start.salas_libres[0];
              change('sala_id', room?.id ?? 0);
              setSelectedRoomName(room?.nombre ?? '');
            }}
            starts={starts}
            value={values.hora_inicio}
          />
          {selectionUnavailable && (
            <p className="alert error" role="alert">
              El horario elegido dejó de estar disponible. Tus datos se conservaron; selecciona otro
              horario.
            </p>
          )}
          {selectedStart && (
            <>
              <Select
                id="appointment-room"
                label="Sala disponible"
                onChange={(event) => {
                  const room = selectedStart.salas_libres.find(
                    (candidate) => candidate.id === Number(event.target.value),
                  );
                  change('sala_id', Number(event.target.value));
                  setSelectedRoomName(room?.nombre ?? '');
                }}
                value={String(values.sala_id)}
              >
                {selectedStart.salas_libres.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.nombre}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
      )}
      {step === 4 && (
        <dl className="appointment-summary">
          <div>
            <dt>Paciente</dt>
            <dd>{currentPatient?.nombre_completo ?? editing?.paciente.nombre_completo}</dd>
          </div>
          <div>
            <dt>Terapeuta</dt>
            <dd>{currentTherapist?.nombre_completo ?? editing?.terapeuta.nombre_completo}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{values.fecha}</dd>
          </div>
          <div>
            <dt>Horario</dt>
            <dd>
              {selectedStart?.hora_inicio ?? values.hora_inicio} ({values.duracion_slots * 30} min)
            </dd>
          </div>
          <div>
            <dt>Sala</dt>
            <dd>{selectedRoomName || editing?.sala.nombre}</dd>
          </div>
        </dl>
      )}

      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <div className="ui-dialog-actions">
        <Button
          onClick={() => (step === 0 ? onOpenChange(false) : setStep((current) => current - 1))}
          variant="secondary"
        >
          {step === 0 ? 'Cerrar' : 'Anterior'}
        </Button>
        {step < 4 ? (
          <Button onClick={nextStep}>Siguiente</Button>
        ) : (
          <Button disabled={loading} onClick={() => void submit()}>
            {loading ? 'Guardando…' : editing ? 'Guardar cambios' : 'Confirmar cita'}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
