const { AppError } = require('../utils/errors');
const { PERMISOS } = require('../config/permisos');

/** Exige que el usuario autenticado tenga alguno de los roles indicados. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Token de autenticación requerido.', 401));
    }

    if (!roles.includes(req.user.rol)) {
      return next(new AppError('No tienes permisos para realizar esta acción.', 403));
    }

    return next();
  };
}

/** Exige el permiso nombrado en config/permisos.js (por ejemplo "pacientes:baja"). */
function requirePermission(permiso) {
  const roles = PERMISOS[permiso];

  if (!roles) {
    throw new Error(`Permiso desconocido: ${permiso}`);
  }

  return requireRole(...roles);
}

module.exports = { requireRole, requirePermission };
