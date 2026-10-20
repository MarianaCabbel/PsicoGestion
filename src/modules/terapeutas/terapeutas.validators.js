const { z } = require('zod');
const {
  EDAD_MINIMA_TERAPEUTA,
  EDAD_MAXIMA,
  DIAS_ATENCION,
  HORA_INICIO,
  HORA_FIN,
  SLOT_MINUTOS,
} = require('../../config/clinica');
const { esHoraValida, horaAMinutos } = require('../../lib/fechas');
const {
  textoRequerido,
  nombrePersona,
  telefonoDiezDigitos,
  fechaCalendario,
  agregarReglasDeEdad,
  correoNormalizado,
  consultaListado,
} = require('../comun.validators');

const campos = {
  nombre_completo: nombrePersona('El nombre completo'),
  telefono: telefonoDiezDigitos('El teléfono'),
  correo: correoNormalizado('El correo es obligatorio.'),
  fecha_nacimiento: fechaCalendario('La fecha de nacimiento'),
  cedula_profesional: z.preprocess(
    (valor) => (typeof valor === 'string' || typeof valor === 'number' ? String(valor).replace(/\s/g, '') : ''),
    z
      .string()
      .min(1, 'La cédula profesional es obligatoria.')
      .regex(/^\d{7,8}$/, 'La cédula profesional debe tener 7 u 8 dígitos.')
  ),
};

const baseSchema = z.object(campos);

const reglasDeFecha = (datos, ctx) => {
  if (datos.fecha_nacimiento === undefined) return;

  agregarReglasDeEdad(ctx, datos.fecha_nacimiento, {
    minima: EDAD_MINIMA_TERAPEUTA,
    maxima: EDAD_MAXIMA,
    mensajeMinima: `El terapeuta debe tener al menos ${EDAD_MINIMA_TERAPEUTA} años.`,
  });
};

const crearTerapeutaSchema = baseSchema.superRefine(reglasDeFecha);

const actualizarTerapeutaSchema = baseSchema
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, { message: 'Envía al menos un campo para actualizar.' })
  .superRefine(reglasDeFecha);

const listarTerapeutasQuery = consultaListado();

// ---- Horarios semanales ----------------------------------------------------

const MINUTOS_VENTANA_INICIO = horaAMinutos(HORA_INICIO);
const MINUTOS_VENTANA_FIN = horaAMinutos(HORA_FIN);

const horaTexto = (etiqueta) =>
  textoRequerido(`${etiqueta} es obligatoria.`, (base) =>
    base.refine((valor) => esHoraValida(valor), `${etiqueta} debe tener el formato HH:mm.`)
  );

const franjaSchema = z.object({
  dia_semana: z.preprocess(
    (valor) => (valor === '' || valor === null ? undefined : Number(valor)),
    z
      .number({ error: 'El día de la semana es obligatorio.' })
      .int('El día de la semana no es válido.')
      .refine((dia) => DIAS_ATENCION.includes(dia), 'El día seleccionado no es un día de atención.')
  ),
  hora_inicio: horaTexto('La hora de inicio'),
  hora_fin: horaTexto('La hora de fin'),
});

const reemplazarHorariosBody = z.object({
  /** Permite guardar un horario que deja fuera citas pendientes (el cliente ya mostró la advertencia). */
  confirmar_conflictos: z.boolean().optional().default(false),
  horarios: z
    .array(franjaSchema, { error: 'Los horarios deben enviarse como una lista.' })
    .max(60, 'Se permiten como máximo 60 franjas.')
    .superRefine((franjas, ctx) => {
      const porDia = new Map();

      franjas.forEach((franja, indice) => {
        if (!esHoraValida(franja.hora_inicio) || !esHoraValida(franja.hora_fin)) return;

        const inicio = horaAMinutos(franja.hora_inicio);
        const fin = horaAMinutos(franja.hora_fin);
        const error = (campo, message) => ctx.addIssue({ code: 'custom', path: [indice, campo], message });

        if (inicio % SLOT_MINUTOS !== 0) {
          error('hora_inicio', `La hora de inicio debe ser múltiplo de ${SLOT_MINUTOS} minutos.`);
        }
        if (fin % SLOT_MINUTOS !== 0) {
          error('hora_fin', `La hora de fin debe ser múltiplo de ${SLOT_MINUTOS} minutos.`);
        }
        if (inicio < MINUTOS_VENTANA_INICIO) {
          error('hora_inicio', `El horario de atención inicia a las ${HORA_INICIO}.`);
        }
        if (fin > MINUTOS_VENTANA_FIN) {
          error('hora_fin', `El horario de atención termina a las ${HORA_FIN}.`);
        }
        if (inicio >= fin) {
          error('hora_fin', 'La hora de fin debe ser posterior a la hora de inicio.');
          return;
        }

        const existentes = porDia.get(franja.dia_semana) || [];
        const traslape = existentes.some((otra) => inicio < otra.fin && otra.inicio < fin);

        if (traslape) {
          error('hora_inicio', 'Las franjas de un mismo día no pueden traslaparse.');
        }

        existentes.push({ inicio, fin });
        porDia.set(franja.dia_semana, existentes);
      });
    }),
});

module.exports = {
  crearTerapeutaSchema,
  actualizarTerapeutaSchema,
  listarTerapeutasQuery,
  reemplazarHorariosBody,
};
