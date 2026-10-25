const { z } = require('zod');
const { fechaCalendario, idRelacionado } = require('../comun.validators');
const { consultaListado } = require('../comun.validators');

const consultarAuditoriaQuery = consultaListado(['todos'])
  .omit({ q: true, estado: true })
  .extend({
    desde: fechaCalendario('La fecha inicial').optional(),
    hasta: fechaCalendario('La fecha final').optional(),
    accion: z.string().trim().min(1).max(40).optional(),
    entidad: z.string().trim().min(1).max(40).optional(),
    usuario_id: z.preprocess(
      (value) => (value === '' || value === undefined ? undefined : value),
      idRelacionado('El usuario no es válido.').optional(),
    ),
  })
  .superRefine((query, ctx) => {
    if (query.desde && query.hasta && query.hasta < query.desde) {
      ctx.addIssue({
        code: 'custom',
        path: ['hasta'],
        message: 'La fecha final no puede ser anterior a la inicial.',
      });
    }
  });

module.exports = { consultarAuditoriaQuery };
