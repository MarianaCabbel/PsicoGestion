const jwt = require('jsonwebtoken');
const { User } = require('../config/database');
const { AppError } = require('../utils/errors');
const { getJwtSecret } = require('../config/env');
const { SESSION_COOKIE, parseCookies } = require('../lib/cookies');

/** El token puede llegar como Bearer (API/pruebas) o en la cookie httpOnly de sesión. */
function extractToken(req) {
  const authHeader = req.headers.authorization || '';

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE] || null;
}

async function authenticateToken(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return next(new AppError('Token de autenticación requerido.', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (error) {
    return next(new AppError('Token inválido o expirado.', 401));
  }

  try {
    const user = await User.findByPk(decoded.id);

    if (!user || Number(decoded.ver) !== user.token_version) {
      return next(new AppError('La sesión ya no es válida. Inicia sesión de nuevo.', 401));
    }

    // El rol se lee siempre de la base: un cambio de rol surte efecto sin esperar al JWT.
    req.user = { ...decoded, rol: user.rol };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  authenticateToken,
};
