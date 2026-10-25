'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  scheduleValidationError,
  therapistSchema,
  type ScheduleBlock,
  type TherapistFormValues,
  type TherapistPayload,
} from '@/lib/clinical-validation';
import { validateTherapistPhoto } from '@/lib/clinical-validation';

export type TherapistRecord = {
  id: number;
  nombre_completo: string;
  telefono: string;
  correo: string;
  fecha_nacimiento: string;
  cedula_profesional: string;
  estado: 'activo' | 'baja';
  tiene_foto: boolean;
  horarios?: ScheduleBlock[];
};

const weekdays = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
];

const initialValues: TherapistFormValues = {
  nombre_completo: '',
  telefono: '',
  correo: '',
  fecha_nacimiento: '',
  cedula_profesional: '',
};

export function TherapistForm({
  therapist,
  onSave,
  onCancel,
  busy = false,
}: {
  therapist: TherapistRecord | null;
  onSave: (
    values: TherapistPayload,
    photo: File | null,
    schedule: ScheduleBlock[],
    editing: boolean,
  ) => Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const editing = therapist !== null;
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [validatingPhoto, setValidatingPhoto] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>(therapist?.horarios ?? []);
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<TherapistFormValues, unknown, TherapistPayload>({
    resolver: zodResolver(therapistSchema),
    mode: 'onChange',
    defaultValues: therapist
      ? {
          nombre_completo: therapist.nombre_completo,
          telefono: therapist.telefono,
          correo: therapist.correo,
          fecha_nacimiento: therapist.fecha_nacimiento.slice(0, 10),
          cedula_profesional: therapist.cedula_profesional,
        }
      : initialValues,
  });
  const scheduleError = scheduleValidationError(schedule);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPhoto(null);
    setPhotoError('');
    if (!file) return;
    setValidatingPhoto(true);
    try {
      await validateTherapistPhoto(file);
      setPhoto(file);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'La foto seleccionada no es válida.';
      setPhotoError(message);
      toast.error(message);
      event.target.value = '';
    } finally {
      setValidatingPhoto(false);
    }
  }

  function setDayEnabled(day: number, enabled: boolean) {
    setSchedule((current) => {
      if (enabled) {
        return [...current, { dia_semana: day, hora_inicio: '09:00', hora_fin: '17:00' }].sort(
          (left, right) => left.dia_semana - right.dia_semana,
        );
      }
      return current.filter((block) => block.dia_semana !== day);
    });
  }

  function setTime(day: number, field: 'hora_inicio' | 'hora_fin', value: string) {
    setSchedule((current) =>
      current.map((block) => (block.dia_semana === day ? { ...block, [field]: value } : block)),
    );
  }

  return (
    <form
      className="clinical-form"
      onSubmit={handleSubmit((values) => {
        if (scheduleError) {
          toast.error(scheduleError);
          return;
        }
        void onSave(values, photo, schedule, editing);
      })}
    >
      <div className="clinical-form-grid">
        <Input
          autoComplete="name"
          error={errors.nombre_completo?.message}
          label="Nombre completo"
          {...register('nombre_completo')}
        />
        <Input
          autoComplete="tel"
          error={errors.telefono?.message}
          label="Teléfono"
          {...register('telefono')}
        />
        <Input
          autoComplete="email"
          error={errors.correo?.message}
          label="Correo electrónico"
          type="email"
          {...register('correo')}
        />
        <Input
          error={errors.fecha_nacimiento?.message}
          label="Fecha de nacimiento"
          type="date"
          {...register('fecha_nacimiento')}
        />
        <Input
          error={errors.cedula_profesional?.message}
          inputMode="numeric"
          label="Cédula profesional (7–8 dígitos)"
          maxLength={8}
          {...register('cedula_profesional')}
        />
      </div>

      <div className="clinical-photo-field">
        <label className="ui-label" htmlFor="therapist-photo">
          Foto de perfil{' '}
          {editing && therapist?.tiene_foto ? '(opcional, reemplaza la actual)' : '(opcional)'}
        </label>
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-describedby="therapist-photo-hint therapist-photo-error"
          className="ui-input"
          id="therapist-photo"
          onChange={(event) => void choosePhoto(event)}
          type="file"
        />
        <small id="therapist-photo-hint">
          JPEG, PNG o WebP. Máximo 2 MB y mínimo 200 × 200 px.
        </small>
        {validatingPhoto && <span role="status">Validando dimensiones…</span>}
        {photo && <span role="status">Foto lista: {photo.name}</span>}
        {photoError && (
          <span className="ui-field-error" id="therapist-photo-error" role="alert">
            {photoError}
          </span>
        )}
      </div>

      <fieldset className="schedule-fieldset">
        <legend>Horario semanal recurrente</legend>
        <p>
          Selecciona los días de atención y define horas en bloques de 30 minutos, entre 07:00 y
          19:00.
        </p>
        <div className="schedule-days">
          {weekdays.map((day) => {
            const block = schedule.find((item) => item.dia_semana === day.id);
            return (
              <div className="schedule-day" key={day.id}>
                <label className="ui-checkbox">
                  <input
                    checked={Boolean(block)}
                    onChange={(event) => setDayEnabled(day.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span>{day.label}</span>
                </label>
                {block && (
                  <div className="schedule-times">
                    <label>
                      <span>Desde</span>
                      <input
                        aria-label={`${day.label}: hora inicial`}
                        max="18:30"
                        min="07:00"
                        onChange={(event) => setTime(day.id, 'hora_inicio', event.target.value)}
                        step={1800}
                        type="time"
                        value={block.hora_inicio}
                      />
                    </label>
                    <label>
                      <span>Hasta</span>
                      <input
                        aria-label={`${day.label}: hora final`}
                        max="19:00"
                        min="07:30"
                        onChange={(event) => setTime(day.id, 'hora_fin', event.target.value)}
                        step={1800}
                        type="time"
                        value={block.hora_fin}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {scheduleError && (
          <p className="clinical-error" role="alert">
            {scheduleError}
          </p>
        )}
      </fieldset>

      <div className="clinical-form-actions">
        <Button disabled={busy} onClick={onCancel} variant="secondary">
          Cancelar
        </Button>
        <Button
          disabled={busy || validatingPhoto || !isValid || Boolean(scheduleError)}
          type="submit"
        >
          {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar terapeuta'}
        </Button>
      </div>
    </form>
  );
}
