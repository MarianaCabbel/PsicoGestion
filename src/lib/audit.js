const { AuditLog } = require('../config/database');

/**
 * Registra una acción sobre datos personales. `detalle` NUNCA debe llevar
 * valores personales (nombres, CURP, teléfonos): solo nombres de campos y
 * metadatos. Si se pasa `transaction`, la bitácora es atómica con el cambio.
 */
async function registrarAuditoria(
  { usuarioId = null, accion, entidad, entidadId = null, detalle = null, ip = null },
  { transaction, mejorEsfuerzo = false } = {}
) {
  const registro = {
    usuario_id: usuarioId,
    accion,
    entidad,
    entidad_id: entidadId,
    detalle,
    ip: ip ? String(ip).slice(0, 64) : null,
  };

  if (!mejorEsfuerzo) {
    return AuditLog.create(registro, { transaction });
  }

  try {
    return await AuditLog.create(registro, { transaction });
  } catch (error) {
    console.error(`[auditoria] No se pudo registrar ${accion} sobre ${entidad}: ${error.message}`);
    return null;
  }
}

/** Contexto de auditoría derivado de la petición autenticada. */
function contextoDe(req) {
  return { usuarioId: req.user ? req.user.id : null, ip: req.ip };
}

module.exports = { registrarAuditoria, contextoDe };
