const { z } = require('zod');
const { consultaListado } = require('../comun.validators');

const listarQuery = consultaListado(['todos']).omit({ q: true, estado: true });

const correoBody = z.object({
  correo: z
    .string()
    .trim()
    .max(150, 'El correo no puede exceder 150 caracteres.')
    .transform((correo) => correo.toLowerCase())
    .pipe(z.email({ error: 'El correo electrónico no es válido.' })),
});

const cambiarRolBody = z.object({
  rol: z.enum(['secretaria', 'administrador'], { error: 'El rol solicitado no es válido.' }),
});

module.exports = { listarQuery, correoBody, cambiarRolBody };
