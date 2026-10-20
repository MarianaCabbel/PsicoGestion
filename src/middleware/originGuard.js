const { AppError } = require('../utils/errors');
const { getAllowedOrigins } = require('../config/env');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defensa adicional contra CSRF cuando la sesión viaja en cookie: toda petición
 * que modifica datos y trae cabecera Origin debe venir de un origen autorizado.
 * (SameSite=Lax ya bloquea la mayoría de los casos; esto cubre navegadores
 * antiguos y configuraciones atípicas.)
 */
function originGuard(req, res, next) {
  if (METODOS_SEGUROS.has(req.method)) return next();

  const origin = req.headers.origin;
  if (!origin) return next();

  const host = `${req.protocol}://${req.get('host')}`;
  if (origin === host || getAllowedOrigins().includes(origin)) return next();

  return next(new AppError('Origen no autorizado.', 403));
}

module.exports = { originGuard };
