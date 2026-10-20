const { z } = require('zod');
const { EDAD_MINIMA_PACIENTE, EDAD_MAXIMA } = require('../../config/clinica');
const { validarCurp, normalizarCurp, inconsistenciasCurp } = require('../../lib/curp');
const {
  textoRequerido,
  nombrePersona,
  telefonoDiezDigitos,
  fechaCalendario,
  agregarReglasDeEdad,
  correoOpcional,
  consultaListado,
} = require('../comun.validators');

const campos = {
  nombre_completo: nombrePersona('El nombre completo'),
  curp: textoRequerido('La CURP es obligatoria.', (base) =>
    base
      .transform((valor) => normalizarCurp(valor))
      .superRefine((valor, ctx) => {
        const resultado = validarCurp(valor);

        if (!resultado.valido) {
          ctx.addIssue({ code: 'custom', message: resultado.error });
        }
      })
  ),
  sexo: z.preprocess(
    (valor) => (typeof valor === 'string' ? valor.trim().toUpperCase() : valor),
    z.enum(['H', 'M', 'X'], { error: 'El sexo debe ser H, M o X.' })
  ),
  fecha_nacimiento: fechaCalendario('La fecha de nacimiento'),
  telefono: telefonoDiezDigitos('El teléfono'),
  correo: correoOpcional(),
};

const baseSchema = z.object(campos);

const reglasDeFecha = (datos, ctx) => {
  if (datos.fecha_nacimiento === undefined) return;

  agregarReglasDeEdad(ctx, datos.fecha_nacimiento, {
    minima: EDAD_MINIMA_PACIENTE,
    maxima: EDAD_MAXIMA,
    mensajeMinima: `La edad mínima del paciente es de ${EDAD_MINIMA_PACIENTE} años.`,
  });
};

/** Si vienen CURP, fecha y sexo juntos, deben coincidir entre sí. */
const reglasDeConsistencia = (datos, ctx) => {
  if (!datos.curp || !datos.fecha_nacimiento || !datos.sexo) return;

  const errores = inconsistenciasCurp(datos);
  Object.entries(errores).forEach(([campo, message]) => {
    ctx.addIssue({ code: 'custom', path: [campo], message });
  });
};

const crearPacienteSchema = baseSchema.superRefine((datos, ctx) => {
  reglasDeFecha(datos, ctx);
  reglasDeConsistencia(datos, ctx);
});

/** Actualización parcial: al menos un campo; la consistencia completa se revalida en el servicio. */
const actualizarPacienteSchema = baseSchema
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, { message: 'Envía al menos un campo para actualizar.' })
  .superRefine((datos, ctx) => {
    reglasDeFecha(datos, ctx);
    reglasDeConsistencia(datos, ctx);
  });

const listarPacientesQuery = consultaListado();

const consentimientoBody = z.object({
  aceptado: z.literal(true, { error: 'El consentimiento debe ser aceptado expresamente.' }),
});

module.exports = {
  crearPacienteSchema,
  actualizarPacienteSchema,
  listarPacientesQuery,
  consentimientoBody,
};
