import { describe, expect, it, vi } from 'vitest';
import {
  affectedAppointmentFolios,
  curpCheckDigit,
  curpError,
  edadEnAnios,
  hoyEnClinica,
  patientSchema,
  scheduleValidationError,
  therapistSchema,
  validateTherapistPhoto,
  type ScheduleBlock,
} from './clinical-validation';

const alphabet = 'BCDFGHJKLMNPQRSTVWXYZ';

/** Fecha (YYYY-MM-DD) de hace `anios` años, conservando mes y día. */
function fechaHaceAnios(anios: number) {
  const [year, month, day] = hoyEnClinica().split('-').map(Number);
  return `${String(year - anios).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function mensajesDeFecha(resultado: ReturnType<typeof therapistSchema.safeParse>) {
  return resultado.success
    ? []
    : resultado.error.issues
        .filter((issue) => issue.path[0] === 'fecha_nacimiento')
        .map((issue) => issue.message);
}

function validCurp() {
  const consonants = [0, 7, 14].map((index) => alphabet[index % alphabet.length]).join('');
  const base = `AEAG900427HYN${consonants}0`;
  return `${base}${curpCheckDigit(base)}`;
}

describe('clinical validation', () => {
  it('validates the CURP structure and official check digit', () => {
    const curp = validCurp();
    expect(curpError(curp)).toBeNull();
    expect(curpError(`${curp.slice(0, 17)}${(Number(curp[17]) + 1) % 10}`)).toContain(
      'dígito verificador',
    );
    expect(curpError('AEAG900231HYNBCD00')).toContain('fecha');
  });

  it('requires privacy consent and matches its encoded sex and date', () => {
    const base = {
      nombre_completo: 'María Pérez',
      curp: validCurp(),
      sexo: 'H' as const,
      fecha_nacimiento: '1990-04-27',
      telefono: '9991234567',
      correo: '',
    };
    expect(patientSchema.safeParse({ ...base, acepta_aviso: false }).success).toBe(false);
    expect(patientSchema.safeParse({ ...base, acepta_aviso: true }).success).toBe(true);
    expect(
      patientSchema.safeParse({ ...base, fecha_nacimiento: '1991-04-27', acepta_aviso: true })
        .success,
    ).toBe(false);
  });

  it('validates professional license numbers', () => {
    const therapist = {
      nombre_completo: 'Ana Terapeuta',
      telefono: '9991234567',
      correo: 'ana@uady.mx',
      fecha_nacimiento: '1985-06-15',
    };
    expect(therapistSchema.safeParse({ ...therapist, cedula_profesional: '1234567' }).success).toBe(
      true,
    );
    expect(therapistSchema.safeParse({ ...therapist, cedula_profesional: '123456' }).success).toBe(
      false,
    );
  });

  it('enforces the 50-character name limit and allowed characters', () => {
    const therapist = {
      telefono: '9991234567',
      correo: 'ana@uady.mx',
      fecha_nacimiento: '1985-06-15',
      cedula_profesional: '1234567',
    };
    expect(
      therapistSchema.safeParse({ ...therapist, nombre_completo: 'a'.repeat(51) }).success,
    ).toBe(false);
    expect(
      therapistSchema.safeParse({ ...therapist, nombre_completo: 'Ana 123' }).success,
    ).toBe(false);
    expect(
      therapistSchema.safeParse({ ...therapist, nombre_completo: 'María Pérez-Núñez' }).success,
    ).toBe(true);
  });

  it('requires therapists to be between 21 and 120 years old and not born in the future', () => {
    const therapist = {
      nombre_completo: 'Ana Terapeuta',
      telefono: '9991234567',
      correo: 'ana@uady.mx',
      cedula_profesional: '1234567',
    };

    expect(edadEnAnios(fechaHaceAnios(21))).toBe(21);
    expect(
      therapistSchema.safeParse({ ...therapist, fecha_nacimiento: fechaHaceAnios(21) }).success,
    ).toBe(true);
    expect(
      mensajesDeFecha(
        therapistSchema.safeParse({ ...therapist, fecha_nacimiento: fechaHaceAnios(20) }),
      ),
    ).toContain('El terapeuta debe tener al menos 21 años.');
    expect(
      mensajesDeFecha(
        therapistSchema.safeParse({ ...therapist, fecha_nacimiento: fechaHaceAnios(121) }),
      ),
    ).toContain('La fecha de nacimiento no es válida.');
    expect(
      mensajesDeFecha(
        therapistSchema.safeParse({ ...therapist, fecha_nacimiento: fechaHaceAnios(-1) }),
      ),
    ).toContain('La fecha de nacimiento no puede ser futura.');
  });

  it('requires patients to be at least 7 years old and not born in the future', () => {
    const base = {
      nombre_completo: 'María Pérez',
      curp: validCurp(),
      sexo: 'H' as const,
      telefono: '9991234567',
      correo: '',
      acepta_aviso: true,
    };
    const mensajes = (fecha_nacimiento: string) => {
      const resultado = patientSchema.safeParse({ ...base, fecha_nacimiento });
      return resultado.success
        ? []
        : resultado.error.issues
            .filter((issue) => issue.path[0] === 'fecha_nacimiento')
            .map((issue) => issue.message);
    };

    expect(mensajes(fechaHaceAnios(6))).toContain('La edad mínima del paciente es de 7 años.');
    expect(mensajes(fechaHaceAnios(121))).toContain('La fecha de nacimiento no es válida.');
    expect(mensajes(fechaHaceAnios(-1))).toContain(
      'La fecha de nacimiento no puede ser futura.',
    );
  });

  it('rejects overlaps, weekends, out-of-window hours, and accepts 30-minute blocks', () => {
    const valid: ScheduleBlock = {
      dia_semana: 1,
      hora_inicio: '07:30',
      hora_fin: '09:00',
    };
    expect(scheduleValidationError([valid])).toBeNull();
    expect(
      scheduleValidationError([valid, { dia_semana: 1, hora_inicio: '08:30', hora_fin: '10:00' }]),
    ).toContain('traslaparse');
    expect(scheduleValidationError([{ ...valid, dia_semana: 6 }])).toContain('lunes a viernes');
    expect(scheduleValidationError([{ ...valid, hora_inicio: '06:30' }])).toContain(
      '07:00 y 19:00',
    );
  });

  it('checks the image file size, type and decoded dimensions', async () => {
    await expect(
      validateTherapistPhoto(
        new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
      ),
    ).rejects.toThrow('2 MB');
    await expect(
      validateTherapistPhoto(new File(['x'], 'animation.gif', { type: 'image/gif' })),
    ).rejects.toThrow('JPEG, PNG o WebP');

    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 199, height: 300, close }),
    );
    await expect(
      validateTherapistPhoto(new File(['x'], 'small.png', { type: 'image/png' })),
    ).rejects.toThrow('200×200');
    expect(close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('extracts affected appointment folios only from a well-formed HTTP 409 response', () => {
    expect(affectedAppointmentFolios(409, { folios_afectados: ['CIT-2026-000001'] })).toEqual([
      'CIT-2026-000001',
    ]);
    expect(affectedAppointmentFolios(409, { folios_afectados: [17] })).toBeNull();
    expect(affectedAppointmentFolios(400, { folios_afectados: ['CIT-2026-000001'] })).toBeNull();
  });
});
