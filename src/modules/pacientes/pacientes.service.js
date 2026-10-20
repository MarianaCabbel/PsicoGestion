const { Op, UniqueConstraintError } = require('sequelize');
const { Paciente } = require('../../config/database');
const { AppError } = require('../../utils/errors');
const { AVISO_PRIVACIDAD_VERSION, EDAD_MINIMA_PACIENTE } = require('../../config/clinica');
const { inconsistenciasCurp, validarCurp } = require('../../lib/curp');
const { edadEnAnios, hoyEnClinica } = require('../../lib/fechas');
const { registrarAuditoria } = require('../../lib/audit');
const { conTransaccion } = require('../../lib/transaccion');
const { verificarBajaPermitida } = require('../../lib/bajaGuards');
const {
  calcularPaginacion,
  respuestaPaginada,
  operadorLike,
  patronContiene,
} = require('../../lib/paginacion');

function serializar(paciente) {
  return {
    id: paciente.id,
    nombre_completo: paciente.nombre_completo,
    curp: paciente.curp,
    sexo: paciente.sexo,
    fecha_nacimiento: paciente.fecha_nacimiento,
    edad: edadEnAnios(paciente.fecha_nacimiento),
    telefono: paciente.telefono,
    correo: paciente.correo,
    estado: paciente.estado,
    consentimiento_at: paciente.consentimiento_at,
    aviso_version: paciente.aviso_version,
    created_at: paciente.created_at,
    updated_at: paciente.updated_at,
    baja_at: paciente.baja_at,
  };
}

async function buscarPorId(id, { incluirBajas = true, transaction } = {}) {
  const paciente = await Paciente.findByPk(id, { paranoid: !incluirBajas, transaction });

  if (!paciente) {
    throw new AppError('Paciente no encontrado.', 404);
  }

  return paciente;
}

function errorCurpDuplicada(existente) {
  const mensaje = existente.baja_at
    ? 'Existe un paciente dado de baja con esta CURP. Solicita su reactivación a un administrador.'
    : 'Ya existe un paciente registrado con esta CURP.';

  return new AppError(mensaje, 409, null, { curp: mensaje });
}

async function asegurarCurpDisponible(curp, { excluirId, transaction } = {}) {
  const where = { curp };
  if (excluirId) where.id = { [Op.ne]: excluirId };

  const existente = await Paciente.findOne({ where, paranoid: false, transaction });

  if (existente) {
    throw errorCurpDuplicada(existente);
  }
}

async function crear(datos, contexto) {
  await asegurarCurpDisponible(datos.curp);

  try {
    return await conTransaccion(async (transaction) => {
      const paciente = await Paciente.create({ ...datos, creado_por: contexto.usuarioId }, { transaction });

      await registrarAuditoria(
        { ...contexto, accion: 'crear', entidad: 'paciente', entidadId: paciente.id },
        { transaction }
      );

      return serializar(paciente);
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new AppError('Ya existe un paciente registrado con esta CURP.', 409, null, {
        curp: 'Ya existe un paciente registrado con esta CURP.',
      });
    }
    throw error;
  }
}

async function listar({ q, estado, page, limit }) {
  const paginacion = calcularPaginacion({ page, limit });
  const where = {};
  let paranoid = true;

  if (estado === 'baja') {
    paranoid = false;
    where.baja_at = { [Op.ne]: null };
  } else if (estado === 'todos') {
    paranoid = false;
  }

  if (q) {
    const like = operadorLike();
    const patron = patronContiene(q);
    const soloDigitos = q.replace(/\D/g, '');

    where[Op.and] = [
      {
        [Op.or]: [
          { nombre_completo: { [like]: patron } },
          { curp: { [like]: patronContiene(q.toUpperCase()) } },
          ...(soloDigitos ? [{ telefono: { [like]: `%${soloDigitos}%` } }] : []),
        ],
      },
    ];
  }

  const { rows, count } = await Paciente.findAndCountAll({
    where,
    paranoid,
    order: [
      ['nombre_completo', 'ASC'],
      ['id', 'ASC'],
    ],
    limit: paginacion.limit,
    offset: paginacion.offset,
  });

  return respuestaPaginada(rows.map(serializar), count, paginacion);
}

async function obtener(id, contexto) {
  const paciente = await buscarPorId(id);

  // Consultar un perfil es acceso a datos personales: queda en bitácora (sin valores).
  await registrarAuditoria(
    { ...contexto, accion: 'consultar', entidad: 'paciente', entidadId: paciente.id },
    { mejorEsfuerzo: true }
  );

  return serializar(paciente);
}

async function actualizar(id, cambios, contexto) {
  return conTransaccion(async (transaction) => {
    const paciente = await buscarPorId(id, { transaction });

    if (paciente.baja_at) {
      throw new AppError('El paciente está dado de baja. Debe reactivarse antes de editarlo.', 409);
    }

    const resultante = {
      curp: cambios.curp ?? paciente.curp,
      sexo: cambios.sexo ?? paciente.sexo,
      fecha_nacimiento: cambios.fecha_nacimiento ?? paciente.fecha_nacimiento,
    };

    // Se revalida la combinación completa porque la actualización puede ser parcial.
    const erroresConsistencia = inconsistenciasCurp(resultante);
    if (Object.keys(erroresConsistencia).length > 0) {
      const primero = Object.values(erroresConsistencia)[0];
      throw new AppError(primero, 400, null, erroresConsistencia);
    }

    if (cambios.fecha_nacimiento && edadEnAnios(resultante.fecha_nacimiento, hoyEnClinica()) < EDAD_MINIMA_PACIENTE) {
      const mensaje = `La edad mínima del paciente es de ${EDAD_MINIMA_PACIENTE} años.`;
      throw new AppError(mensaje, 400, null, { fecha_nacimiento: mensaje });
    }

    if (cambios.curp && cambios.curp !== paciente.curp) {
      if (!validarCurp(cambios.curp).valido) {
        throw new AppError('La CURP no es válida.', 400, null, { curp: 'La CURP no es válida.' });
      }
      await asegurarCurpDisponible(cambios.curp, { excluirId: paciente.id, transaction });
    }

    await paciente.update(cambios, { transaction });

    await registrarAuditoria(
      {
        ...contexto,
        accion: 'actualizar',
        entidad: 'paciente',
        entidadId: paciente.id,
        detalle: { campos: Object.keys(cambios).sort() },
      },
      { transaction }
    );

    return serializar(paciente);
  });
}

async function darDeBaja(id, contexto) {
  return conTransaccion(async (transaction) => {
    const paciente = await buscarPorId(id, { transaction });

    if (paciente.baja_at) {
      throw new AppError('El paciente ya está dado de baja.', 409);
    }

    await verificarBajaPermitida('paciente', paciente.id, { transaction });

    await paciente.update({ baja_por: contexto.usuarioId }, { transaction });
    await paciente.destroy({ transaction });

    await registrarAuditoria(
      { ...contexto, accion: 'baja', entidad: 'paciente', entidadId: paciente.id },
      { transaction }
    );
  });
}

async function reactivar(id, contexto) {
  return conTransaccion(async (transaction) => {
    const paciente = await buscarPorId(id, { transaction });

    if (!paciente.baja_at) {
      throw new AppError('El paciente ya está activo.', 409);
    }

    await paciente.restore({ transaction });
    await paciente.update({ baja_por: null }, { transaction });

    await registrarAuditoria(
      { ...contexto, accion: 'reactivar', entidad: 'paciente', entidadId: paciente.id },
      { transaction }
    );

    return serializar(paciente);
  });
}

async function registrarConsentimiento(id, contexto) {
  return conTransaccion(async (transaction) => {
    const paciente = await buscarPorId(id, { incluirBajas: false, transaction });

    await paciente.update(
      { consentimiento_at: new Date(), aviso_version: AVISO_PRIVACIDAD_VERSION },
      { transaction }
    );

    await registrarAuditoria(
      {
        ...contexto,
        accion: 'consentimiento',
        entidad: 'paciente',
        entidadId: paciente.id,
        detalle: { aviso_version: AVISO_PRIVACIDAD_VERSION },
      },
      { transaction }
    );

    return serializar(paciente);
  });
}

module.exports = {
  crear,
  listar,
  obtener,
  actualizar,
  darDeBaja,
  reactivar,
  registrarConsentimiento,
  serializar,
};
