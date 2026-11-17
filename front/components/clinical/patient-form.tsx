'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PrivacyNoticeContent } from '@/components/app/privacy-notice';
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
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
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
  onPrivacyViewChange,
  busy = false,
}: {
  patient: PatientRecord | null;
  onSave: (values: PatientPayload, isEditing: boolean) => Promise<void>;
  onCancel: () => void;
  onPrivacyViewChange?: (open: boolean) => void;
  busy?: boolean;
}) {
  const isEditing = patient !== null;
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const privacyViewRef = useRef<HTMLElement>(null);
  const privacyLinkRef = useRef<HTMLAnchorElement>(null);
  const returnFocusRef = useRef(false);
  const splitName = (full: string) => {
    const parts = full.trim().split(/\s+/);
    if (parts.length <= 1) {
      return { nombre: parts[0] ?? '', apellido_paterno: '', apellido_materno: '' };
    }
    if (parts.length === 2) {
      return { nombre: parts[0], apellido_paterno: parts[1], apellido_materno: '' };
    }
    return {
      nombre: parts[0],
      apellido_paterno: parts[1],
      apellido_materno: parts.slice(2).join(' '),
    };
  };
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
          ...splitName(patient.nombre_completo),
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

  useEffect(() => {
    if (privacyOpen) {
      privacyViewRef.current?.focus();
    } else if (returnFocusRef.current) {
      returnFocusRef.current = false;
      privacyLinkRef.current?.focus();
    }
  }, [privacyOpen]);

  function openPrivacyNotice() {
    setPrivacyOpen(true);
    onPrivacyViewChange?.(true);
  }

  function closePrivacyNotice() {
    returnFocusRef.current = true;
    setPrivacyOpen(false);
    onPrivacyViewChange?.(false);
  }

  return (
    <form className="clinical-form" onSubmit={handleSubmit((values) => onSave(values, isEditing))}>
      <div className="clinical-form-fields" hidden={privacyOpen}>
        <Input
          autoComplete="given-name"
          error={errors.nombre?.message}
          label="Nombre"
          maxLength={50}
          {...register('nombre')}
        />
        <Input
          autoComplete="family-name"
          error={errors.apellido_paterno?.message}
          label="Apellido paterno"
          maxLength={50}
          {...register('apellido_paterno')}
        />
        <Input
          autoComplete="additional-name"
          error={errors.apellido_materno?.message}
          label="Apellido materno"
          maxLength={50}
          {...register('apellido_materno')}
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
          inputMode="numeric"
          label="Teléfono"
          maxLength={10}
          pattern="[0-9]*"
          {...register('telefono')}
          onChange={(event) => {
            setValue('telefono', event.target.value.replace(/\D/g, ''), {
              shouldValidate: true,
            });
          }}
        />
        <Input
          autoComplete="email"
          error={errors.correo?.message}
          label="Correo electrónico"
          maxLength={150}
          type="email"
          {...register('correo')}
        />
        {!isEditing && (
          <div className="privacy-consent">
            <Checkbox
              label={
                <>
                  Leí y acepto el{' '}
                  <Link
                    href="/privacidad"
                    ref={privacyLinkRef}
                    onClick={(event) => {
                      // Se muestra en el mismo modal para no perder los datos capturados.
                      event.preventDefault();
                      event.stopPropagation();
                      openPrivacyNotice();
                    }}
                  >
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
      </div>
      {privacyOpen && (
        <section
          aria-label={`Aviso de privacidad ${PRIVACY_NOTICE_VERSION}`}
          className="privacy-view"
          ref={privacyViewRef}
          tabIndex={-1}
        >
          <PrivacyNoticeContent
            actions={
              <div className="ui-dialog-actions">
                <Button onClick={closePrivacyNotice} variant="secondary">
                  Volver al registro de paciente
                </Button>
              </div>
            }
          />
        </section>
      )}
    </form>
  );
}
