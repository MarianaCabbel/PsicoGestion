const { CorreoAutorizado } = require('../../config/database');
const { getRegistroModo } = require('../../config/env');
const { normalizeEmail } = require('../../utils/authHelpers');

/**
 * Decide si un correo puede crear una cuenta.
 * - Modo "dominio": cualquier correo institucional válido (desarrollo/pruebas).
 * - Modo "lista_blanca": solo correos activos en correos_autorizados. Es el
 *   modo por defecto en producción: poseer un buzón @uady.mx no basta para ver
 *   datos clínicos, hace falta que el SEAP haya autorizado a la persona.
 */
async function correoAutorizadoParaRegistro(correo) {
  if (getRegistroModo() === 'dominio') {
    return true;
  }

  const registro = await CorreoAutorizado.findOne({
    where: { correo: normalizeEmail(correo), activo: true },
  });

  return Boolean(registro);
}

module.exports = { correoAutorizadoParaRegistro };
