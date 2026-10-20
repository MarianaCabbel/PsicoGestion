const { z } = require('zod');
const {
  DURACION_CITA_SLOTS_MAXIMA,
} = require('../../config/clinica');
const { esHoraValida, esFechaValida } = require('../../lib/fechas');
const {
  textoRequerido,
  fechaCalendario,
  idRelacionado,
  consultaListado,
} = require('../comun.validators');

const duracionSlots = z.preprocess(
  (valor) => (valor === '' || valor === null ? undefined : valor),
  z.coerce
    .number({ error: 'La duración no es válida.' })
    .int('La duración no es válida.')
    .min(1, 'La duración mínima es de 1 bloque.')
    .max(DURACION_CITA_SLOTS_MAXIMA, `La duración máxima es de ${DURACION_CITA_SLOTS_MAXIMA} bloques.`)
);

const horaCita = textoRequerido('La hora de la cita es obligatoria.', (base) =>
  base.refine((valor) => esHoraValida(valor), 'La hora debe tener el formato HH:mm.')
);

const camposCita = {
  paciente_id: idRelacionado('Selecciona un paciente.'),
  terapeuta_id: idRelacionado('Selecciona un terapeuta.'),
  sala_id: idRelacionado('Selecciona una sala.'),
  fecha: fechaCalendario('La fecha de la cita'),
  hora_inicio: horaCita,
};

const crearCitaSchema = z.object({
  ...camposCita,
  duracion_slots: duracionSlots.optional(),
});

const actualizarCitaSchema = z
  .object({ ...camposCita, duracion_slots: duracionSlots })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, { message: 'Envía al menos un campo para actualizar.' });

const folioParams = z.object({
  folio: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^CIT-\d{4}-\d{6}$/, 'El folio no tiene un formato válido (CIT-AAAA-000000).'),
});

const cancelarBody = z.object({
  confirmar: z.literal(true, { error: 'Debes confirmar la acción explícitamente.' }),
  motivo: z.preprocess(
    (valor) => (valor === undefined || valor === null || String(valor).trim() === '' ? undefined : valor),
    z.string().trim().max(255, 'El motivo no puede exceder 255 caracteres.').optional()
  ),
});

const opcionalId = (mensaje) =>
  z.preprocess((valor) => (valor === '' ? undefined : valor), idRelacionado(mensaje).optional());

const listarCitasQuery = consultaListado(['todas', 'pendiente', 'cancelada', 'vencida'])
  .omit({ q: true })
  .extend({
    sala_id: opcionalId('La sala no es válida.'),
    terapeuta_id: opcionalId('El terapeuta no es válido.'),
    paciente_id: opcionalId('El paciente no es válido.'),
    rango: z.enum(['dia', 'semana', 'mes'], { error: 'El rango debe ser dia, semana o mes.' }).optional(),
    fecha: z
      .string()
      .refine((valor) => esFechaValida(valor), 'La fecha no es válida (AAAA-MM-DD).')
      .optional(),
    desde: z
      .string()
      .refine((valor) => esFechaValida(valor), 'La fecha inicial no es válida (AAAA-MM-DD).')
      .optional(),
    hasta: z
      .string()
      .refine((valor) => esFechaValida(valor), 'La fecha final no es válida (AAAA-MM-DD).')
      .optional(),
    orden: z.enum(['asc', 'desc'], { error: 'El orden debe ser asc o desc.' }).optional().default('asc'),
  })
  .superRefine((datos, ctx) => {
    if (datos.rango && !datos.fecha) {
      ctx.addIssue({ code: 'custom', path: ['fecha'], message: 'Indica la fecha de referencia del rango.' });
    }
    if (datos.rango && (datos.desde || datos.hasta)) {
      ctx.addIssue({ code: 'custom', path: ['rango'], message: 'Usa rango+fecha o desde/hasta, no ambos.' });
    }
    if (datos.desde && datos.hasta && datos.hasta < datos.desde) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial.' });
    }
  });

const disponibilidadCitasQuery = z.object({
  fecha: fechaCalendario('La fecha'),
  terapeuta_id: idRelacionado('Selecciona un terapeuta.'),
  paciente_id: opcionalId('El paciente no es válido.'),
  duracion_slots: duracionSlots.optional(),
  excluir_cita_id: opcionalId('La cita a excluir no es válida.'),
});

module.exports = {
  crearCitaSchema,
  actualizarCitaSchema,
  folioParams,
  cancelarBody,
  listarCitasQuery,
  disponibilidadCitasQuery,
};
