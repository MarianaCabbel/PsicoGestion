'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import Link from 'next/link';
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacy';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  curpError,
  curpPersonalData,
  patientSchema,
  type PatientFormValues,
  type PatientPayload,
} from '@/lib/clinical-validation';

export type PatientRecord = {
  id: number;
  nombre_completo: string;
  curp: string;
  sexo: 'H' | 'M' | 'X';
  fecha_nacimiento: string;
  telefono: string;
  correo: string | null;
  estado: 'activo' | 'baja';
  consentimiento_at: string | null;
  anonimizado_at?: string | null;
};

const emptyValues: PatientFormValues = {
  nombre_completo: '',
  curp: '',
  sexo: 'H',
  fecha_nacimiento: '',
  telefono: '',
  correo: '',
  acepta_aviso: false,
};

export function PatientForm({
  patient,
  onSave,
  onCancel,
  busy = false,
}: {
  patient: PatientRecord | null;
  onSave: (values: PatientPayload, isEditing: boolean) => Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const isEditing = patient !== null;
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isValid },
  } = useForm<PatientFormValues, unknown, PatientPayload>({
    resolver: zodResolver(patientSchema),
    mode: 'onChange',
    defaultValues: patient
      ? {
          nombre_completo: patient.nombre_completo,
          curp: patient.curp,
          sexo: patient.sexo,
          fecha_nacimiento: patient.fecha_nacimiento.slice(0, 10),
          telefono: patient.telefono,
          correo: patient.correo ?? '',
          acepta_aviso: true,
        }
      : emptyValues,
  });
  const curp = useWatch({ control, name: 'curp' });

  useEffect(() => {
    if (!curp || curp.length !== 18 || curpError(curp)) return;
    const personalData = curpPersonalData(curp);
    if (!personalData) return;
    setValue('fecha_nacimiento', personalData.fecha_nacimiento, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('sexo', personalData.sexo, { shouldDirty: true, shouldValidate: true });
  }, [curp, setValue]);

  return (
    <form className="clinical-form" onSubmit={handleSubmit((values) => onSave(values, isEditing))}>
      <Input
        autoComplete="name"
        error={errors.nombre_completo?.message}
        label="Nombre completo"
        maxLength={100}
        {...register('nombre_completo')}
      />
      <Input
        autoCapitalize="characters"
        autoComplete="off"
        error={errors.curp?.message}
        label="CURP"
        maxLength={18}
        {...register('curp')}
      />
      <div className="clinical-form-row">
        <Input
          error={errors.fecha_nacimiento?.message}
          label="Fecha de nacimiento"
          type="date"
          {...register('fecha_nacimiento')}
        />
        <Select error={errors.sexo?.message} label="Sexo" {...register('sexo')}>
          <option value="H">Hombre</option>
          <option value="M">Mujer</option>
          <option value="X">No especificado</option>
        </Select>
      </div>
      <Input
        autoComplete="tel"
        error={errors.telefono?.message}
        label="Teléfono"
        maxLength={14}
        {...register('telefono')}
      />
      <Input
        autoComplete="email"
        error={errors.correo?.message}
        label="Correo electrónico (opcional)"
        type="email"
        {...register('correo')}
      />
      {!isEditing && (
        <div className="privacy-consent">
          <Checkbox
            label={
              <>
                Leí y acepto el{' '}
                <Link href="/privacidad" target="_blank" rel="noreferrer">
                  aviso de privacidad {PRIVACY_NOTICE_VERSION}
                </Link>{' '}
                para el tratamiento de datos personales.
              </>
            }
            required
            {...register('acepta_aviso')}
          />
          {errors.acepta_aviso?.message && (
            <span className="ui-field-error" role="alert">
              {errors.acepta_aviso.message}
            </span>
          )}
          <small>
            Aviso de privacidad institucional · versión vigente {PRIVACY_NOTICE_VERSION}
          </small>
        </div>
      )}
      <div className="clinical-form-actions">
        <Button disabled={busy} onClick={onCancel} variant="secondary">
          Cancelar
        </Button>
        <Button disabled={busy || !isValid} type="submit">
          {busy ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Registrar paciente'}
        </Button>
      </div>
    </form>
  );
}
