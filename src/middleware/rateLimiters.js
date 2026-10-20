const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { AppError } = require('../utils/errors');
const { normalizeEmail, normalizePhone } = require('../utils/authHelpers');

// En pruebas se desactiva para no interferir con la suite, salvo que una prueba
// de límites lo active explícitamente con FORCE_RATE_LIMIT=true.
const omitir = () => process.env.NODE_ENV === 'test' && process.env.FORCE_RATE_LIMIT !== 'true';

function porIp(req) {
  return ipKeyGenerator(req.ip || '');
}

/** Clave IP + identificador de cuenta: frena fuerza bruta sin bloquear a toda una red. */
function porIpYCuenta(req) {
  const body = req.body || {};
  const cuenta = body.correo_institucional
    ? normalizeEmail(body.correo_institucional)
    : body.telefono
      ? normalizePhone(body.telefono)
      : '';

  return `${porIp(req)}|${cuenta}`;
}

function crearLimitador({ ventanaMs, maximo, mensaje, clave = porIp, omitirExitosas = false }) {
  return rateLimit({
    windowMs: ventanaMs,
    limit: maximo,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: omitir,
    skipSuccessfulRequests: omitirExitosas,
    keyGenerator: clave,
    handler: (req, res, next) => next(new AppError(mensaje, 429)),
  });
}

const MIN = 60 * 1000;

const limitadores = {
  /** Intentos de inicio de sesión fallidos: 10 cada 15 min por IP + cuenta. */
  login: crearLimitador({
    ventanaMs: 15 * MIN,
    maximo: 10,
    clave: porIpYCuenta,
    omitirExitosas: true,
    mensaje: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.',
  }),
  /** Recuperación y reenvío de códigos: 5 cada 15 min por IP + cuenta. */
  correo: crearLimitador({
    ventanaMs: 15 * MIN,
    maximo: 5,
    clave: porIpYCuenta,
    mensaje: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.',
  }),
  /** Verificación de código: 10 cada 15 min por IP + cuenta (además del tope de 3 intentos por código). */
  verificacion: crearLimitador({
    ventanaMs: 15 * MIN,
    maximo: 10,
    clave: porIpYCuenta,
    mensaje: 'Demasiados intentos de verificación. Intenta de nuevo en unos minutos.',
  }),
  /** Altas de cuenta: 10 por hora por IP. */
  registro: crearLimitador({
    ventanaMs: 60 * MIN,
    maximo: 10,
    mensaje: 'Demasiados registros desde esta red. Intenta de nuevo más tarde.',
  }),
  /** Tope general de la API: 300 peticiones por minuto por IP. */
  api: crearLimitador({
    ventanaMs: MIN,
    maximo: 300,
    mensaje: 'Demasiadas peticiones. Espera un momento antes de continuar.',
  }),
};

module.exports = { crearLimitador, limitadores };
