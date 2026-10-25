import { z } from 'zod';

const CURP_ALPHABET = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const CURP_PATTERN =
  /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

export function normalizeCurp(value: string) {
  return value.trim().toUpperCase();
}

export function curpCheckDigit(value: string) {
  const curp = normalizeCurp(value).slice(0, 17);
  let sum = 0;
  for (let index = 0; index < 17; index += 1) {
    const characterValue = CURP_ALPHABET.indexOf(curp[index] ?? '');
    if (characterValue < 0) return null;
    sum += characterValue * (18 - index);
  }
  return (10 - (sum % 10)) % 10;
}

export function curpPersonalData(value: string) {
  const curp = normalizeCurp(value);
  if (curp.length !== 18 || !CURP_PATTERN.test(curp)) return null;

  const yearPart = Number(curp.slice(4, 6));
  const month = Number(curp.slice(6, 8));
  const day = Number(curp.slice(8, 10));
  const year = (/\d/.test(curp[16] ?? '') ? 1900 : 2000) + yearPart;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    fecha_nacimiento: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    sexo: curp[10] as 'H' | 'M' | 'X',
  };
}

export function curpError(value: string) {
  const curp = normalizeCurp(value);
  if (curp.length !== 18) return 'La CURP debe tener 18 caracteres.';
  if (!CURP_PATTERN.test(curp)) return 'La CURP no tiene un formato válido.';
  if (!curpPersonalData(curp)) return 'La fecha incluida en la CURP no es válida.';
  if (curpCheckDigit(curp) !== Number(curp[17])) {
    return 'El dígito verificador de la CURP no es correcto.';
  }
  return null;
}

export const patientSchema = z
  .object({
    nombre_completo: z.string().trim().min(2, 'El nombre es obligatorio.').max(100),
    curp: z
      .string()
      .transform(normalizeCurp)
      .refine((value) => !curpError(value), {
        message: 'La CURP no es válida.',
      }),
    sexo: z.enum(['H', 'M', 'X'], { error: 'Selecciona el sexo.' }),
    fecha_nacimiento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de nacimiento es obligatoria.')
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
      }, 'La fecha no es válida.'),
    telefono: z
      .string()
      .transform((value) => value.replace(/\D/g, ''))
      .pipe(z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos.')),
    correo: z
      .union([z.literal(''), z.email('El correo no es válido.')])
      .transform((value) => value.toLowerCase()),
    acepta_aviso: z.boolean(),
  })
  .superRefine((values, context) => {
    if (!values.acepta_aviso) {
      context.addIssue({
        code: 'custom',
        path: ['acepta_aviso'],
        message: 'Debes aceptar el aviso de privacidad para registrar al paciente.',
      });
    }
    const personalData = curpPersonalData(values.curp);
    if (!personalData) return;
    if (personalData.fecha_nacimiento !== values.fecha_nacimiento) {
      context.addIssue({
        code: 'custom',
        path: ['fecha_nacimiento'],
        message: 'La fecha de nacimiento no coincide con la CURP.',
      });
    }
    if (personalData.sexo !== values.sexo) {
      context.addIssue({
        code: 'custom',
        path: ['sexo'],
        message: 'El sexo no coincide con la CURP.',
      });
    }
  });

export type PatientFormValues = z.input<typeof patientSchema>;
export type PatientPayload = z.output<typeof patientSchema>;

export const therapistSchema = z.object({
  nombre_completo: z.string().trim().min(2, 'El nombre es obligatorio.').max(100),
  telefono: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos.')),
  correo: z.email('El correo no es válido.').transform((value) => value.toLowerCase()),
  fecha_nacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de nacimiento es obligatoria.')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
    }, 'La fecha no es válida.'),
  cedula_profesional: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, 'La cédula debe tener 7 u 8 dígitos.'),
});

export type TherapistFormValues = z.input<typeof therapistSchema>;
export type TherapistPayload = z.output<typeof therapistSchema>;

export async function validateTherapistPhoto(file: File) {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('La foto no puede pesar más de 2 MB.');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('La foto debe ser JPEG, PNG o WebP.');
  }
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este navegador no permite validar las dimensiones de la foto.');
  }

  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error('El archivo no es una imagen válida.');
  }

  const { width, height } = image;
  image.close();
  if (width < 200 || height < 200) {
    throw new Error('La foto debe medir al menos 200×200 píxeles.');
  }
}

export type ScheduleBlock = {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
};

export function affectedAppointmentFolios(status: number, payload: unknown): string[] | null {
  if (status !== 409 || typeof payload !== 'object' || payload === null) return null;
  const folios = Reflect.get(payload, 'folios_afectados');
  return Array.isArray(folios) && folios.every((folio) => typeof folio === 'string')
    ? folios
    : null;
}

export function scheduleValidationError(blocks: ScheduleBlock[]) {
  const dailyRanges = new Map<number, Array<{ start: number; end: number }>>();
  for (const block of blocks) {
    if (block.dia_semana < 1 || block.dia_semana > 5)
      return 'Selecciona un día de lunes a viernes.';
    if (!/^([01]\d|1[0-9]|2[0-3]):(00|30)$/.test(block.hora_inicio)) {
      return 'La hora de inicio debe estar en intervalos de 30 minutos.';
    }
    if (!/^([01]\d|1[0-9]|2[0-3]):(00|30)$/.test(block.hora_fin)) {
      return 'La hora de fin debe estar en intervalos de 30 minutos.';
    }
    const start = block.hora_inicio
      .split(':')
      .reduce((hours, part, index) => hours + Number(part) * (index === 0 ? 60 : 1), 0);
    const end = block.hora_fin
      .split(':')
      .reduce((hours, part, index) => hours + Number(part) * (index === 0 ? 60 : 1), 0);
    if (start < 420 || end > 1140 || start >= end) {
      return 'Los horarios deben estar entre 07:00 y 19:00 y tener fin posterior al inicio.';
    }
    const ranges = dailyRanges.get(block.dia_semana) ?? [];
    if (ranges.some((range) => start < range.end && range.start < end)) {
      return 'Las franjas de un mismo día no pueden traslaparse.';
    }
    ranges.push({ start, end });
    dailyRanges.set(block.dia_semana, ranges);
  }
  return null;
}
