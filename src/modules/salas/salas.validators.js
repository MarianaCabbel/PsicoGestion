const { z } = require('zod');
const { SALA_NOMBRE_MAXIMO, DISPONIBILIDAD_MAX_DIAS } = require('../../config/clinica');
const { esFechaValida } = require('../../lib/fechas');
const { diasEntre } = require('../../lib/rangos');
const { textoRequerido, fechaCalendario, consultaListado } = require('../comun.validators');

const crearSalaSchema = z.object({
  nombre: textoRequerido('El nombre de la sala es obligatorio.', (base) =>
    base
      .max(SALA_NOMBRE_MAXIMO, `El nombre de la sala no puede exceder ${SALA_NOMBRE_MAXIMO} caracteres.`)
      .regex(/^[\p{L}\p{N} .\-]+$/u, 'El nombre de la sala solo puede contener letras, números, espacios, punto y guion.')
      .transform((valor) => valor.replace(/\s+/g, ' '))
  ),
});

const listarSalasQuery = consultaListado(['activa', 'baja', 'todas']);

const disponibilidadDiaQuery = z.object({
  fecha: fechaCalendario('La fecha'),
});

const disponibilidadRangoQuery = z
  .object({
    desde: fechaCalendario('La fecha inicial'),
    hasta: fechaCalendario('La fecha final'),
  })
  .superRefine((datos, ctx) => {
    if (!esFechaValida(datos.desde) || !esFechaValida(datos.hasta)) return;

    if (datos.hasta < datos.desde) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial.' });
    } else if (diasEntre(datos.desde, datos.hasta) > DISPONIBILIDAD_MAX_DIAS) {
      ctx.addIssue({
        code: 'custom',
        path: ['hasta'],
        message: `El rango no puede exceder ${DISPONIBILIDAD_MAX_DIAS} días.`,
      });
    }
  });

module.exports = {
  crearSalaSchema,
  listarSalasQuery,
  disponibilidadDiaQuery,
  disponibilidadRangoQuery,
};
