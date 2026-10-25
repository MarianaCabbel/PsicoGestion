const { z } = require('zod');
const { fechaCalendario, idRelacionado } = require('../comun.validators');

const consultaAgenda = z.object({
  vista: z.enum(['dia', 'semana', 'mes'], { error: 'La vista debe ser dia, semana o mes.' }),
  fecha: fechaCalendario('La fecha'),
  terapeuta_id: z.preprocess(
    (value) => (value === '' ? undefined : value),
    idRelacionado('El terapeuta no es válido.').optional(),
  ),
  sala_id: z.preprocess(
    (value) => (value === '' ? undefined : value),
    idRelacionado('La sala no es válida.').optional(),
  ),
  privado: z
    .enum(['0', '1'])
    .optional()
    .default('0')
    .transform((value) => value === '1'),
});

module.exports = { consultaAgenda };
