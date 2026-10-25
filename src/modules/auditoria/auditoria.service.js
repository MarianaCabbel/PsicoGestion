const { Op } = require('sequelize');
const { AuditLog } = require('../../config/database');
const { calcularPaginacion, respuestaPaginada } = require('../../lib/paginacion');

const CAMPOS_AUDITABLES = new Set([
  'nombre_completo',
  'curp',
  'sexo',
  'fecha_nacimiento',
  'telefono',
  'correo',
  'consentimiento_at',
  'aviso_version',
  'horarios',
  'foto',
  'nombre',
  'estado',
  'rol',
  'token_version',
  'motivo_cancelacion',
  'cancelada_por',
  'creada_por',
  'destinatario',
  'ultimo_error',
]);

function detalleSeguro(detalle) {
  if (!detalle || typeof detalle !== 'object' || Array.isArray(detalle)) return null;

  const seguro = {};
  if (Array.isArray(detalle.campos)) {
    const campos = detalle.campos.filter(
      (campo) => typeof campo === 'string' && CAMPOS_AUDITABLES.has(campo),
    );
    if (campos.length) seguro.campos = campos;
  }
  if (
    typeof detalle.aviso_version === 'string' &&
    /^v\d+(?:\.\d+){0,2}$/.test(detalle.aviso_version)
  ) {
    seguro.aviso_version = detalle.aviso_version;
  }
  return Object.keys(seguro).length ? seguro : null;
}

async function listar(query) {
  const paginacion = calcularPaginacion(query);
  const where = {};
  if (query.accion) where.accion = query.accion;
  if (query.entidad) where.entidad = query.entidad;
  if (query.usuario_id) where.usuario_id = query.usuario_id;
  if (query.desde || query.hasta) {
    where.created_at = {};
    if (query.desde) where.created_at[Op.gte] = new Date(`${query.desde}T00:00:00.000Z`);
    if (query.hasta) where.created_at[Op.lte] = new Date(`${query.hasta}T23:59:59.999Z`);
  }

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    attributes: ['id', 'usuario_id', 'accion', 'entidad', 'entidad_id', 'detalle', 'created_at'],
    order: [
      ['created_at', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: paginacion.limit,
    offset: paginacion.offset,
  });

  return respuestaPaginada(
    rows.map((registro) => ({
      id: registro.id,
      usuario_id: registro.usuario_id,
      accion: registro.accion,
      entidad: registro.entidad,
      entidad_id: registro.entidad_id,
      detalle: detalleSeguro(registro.detalle),
      created_at: registro.created_at,
    })),
    count,
    paginacion,
  );
}

module.exports = { listar, detalleSeguro };
