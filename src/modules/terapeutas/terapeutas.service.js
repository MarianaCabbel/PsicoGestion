const sharp = require('sharp');
const { Op, UniqueConstraintError } = require('sequelize');
const { Terapeuta, TerapeutaFoto, TerapeutaHorario } = require('../../config/database');
const { AppError } = require('../../utils/errors');
const { FOTO_MIN_PX, FOTO_SALIDA_PX } = require('../../config/clinica');
const { edadEnAnios } = require('../../lib/fechas');
const { registrarAuditoria } = require('../../lib/audit');
const { conTransaccion } = require('../../lib/transaccion');
const { verificarBajaPermitida } = require('../../lib/bajaGuards');
const { afectadosPorCambioDeHorario } = require('../../lib/cambioHorarioGuards');
const {
  calcularPaginacion,
  respuestaPaginada,
  operadorLike,
  patronContiene,
} = require('../../lib/paginacion');

const FORMATOS_FOTO = new Set(['jpeg', 'png', 'webp']);
const MAX_PIXELES_ENTRADA = 25_000_000;

function serializar(terapeuta, { horarios } = {}) {
  const resultado = {
    id: terapeuta.id,
    nombre_completo: terapeuta.nombre_completo,
    telefono: terapeuta.telefono,
    correo: terapeuta.correo,
    fecha_nacimiento: terapeuta.fecha_nacimiento,
    edad: edadEnAnios(terapeuta.fecha_nacimiento),
    cedula_profesional: terapeuta.cedula_profesional,
    estado: terapeuta.estado,
    tiene_foto: Boolean(terapeuta.foto),
    created_at: terapeuta.created_at,
    updated_at: terapeuta.updated_at,
    baja_at: terapeuta.baja_at,
  };

  if (horarios) {
    resultado.horarios = horarios.map(serializarHorario);
  }

  return resultado;
}

function serializarHorario(horario) {
  return {
    dia_semana: horario.dia_semana,
    hora_inicio: horario.hora_inicio,
    hora_fin: horario.hora_fin,
  };
}

/** La foto se incluye solo como metadato: el binario nunca viaja en listados. */
const incluirMetadatoFoto = { model: TerapeutaFoto, as: 'foto', attributes: ['id'], required: false };

async function buscarPorId(id, { incluirBajas = true, transaction, conFoto = false } = {}) {
  const terapeuta = await Terapeuta.findByPk(id, {
    paranoid: !incluirBajas,
    transaction,
    include: conFoto ? [incluirMetadatoFoto] : [],
  });

  if (!terapeuta) {
    throw new AppError('Terapeuta no encontrado.', 404);
  }

  return terapeuta;
}

async function asegurarUnicos({ correo, cedula_profesional }, { excluirId, transaction } = {}) {
  const errores = {};
  const excluir = excluirId ? { id: { [Op.ne]: excluirId } } : {};

  if (correo) {
    const existente = await Terapeuta.findOne({ where: { correo, ...excluir }, paranoid: false, transaction });
    if (existente) {
      errores.correo = existente.baja_at
        ? 'Existe un terapeuta dado de baja con este correo. Solicita su reactivación a un administrador.'
        : 'Ya existe un terapeuta registrado con este correo.';
    }
  }

  if (cedula_profesional) {
    const existente = await Terapeuta.findOne({
      where: { cedula_profesional, ...excluir },
      paranoid: false,
      transaction,
    });
    if (existente) {
      errores.cedula_profesional = existente.baja_at
        ? 'Existe un terapeuta dado de baja con esta cédula. Solicita su reactivación a un administrador.'
        : 'Ya existe un terapeuta registrado con esta cédula profesional.';
    }
  }

  const primero = Object.values(errores)[0];
  if (primero) {
    throw new AppError(primero, 409, null, errores);
  }
}

async function crear(datos, contexto) {
  await asegurarUnicos(datos);

  try {
    return await conTransaccion(async (transaction) => {
      const terapeuta = await Terapeuta.create({ ...datos, creado_por: contexto.usuarioId }, { transaction });

      await registrarAuditoria(
        { ...contexto, accion: 'crear', entidad: 'terapeuta', entidadId: terapeuta.id },
        { transaction }
      );

      return serializar(terapeuta);
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new AppError('Ya existe un terapeuta con ese correo o cédula profesional.', 409);
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
    const soloDigitos = q.replace(/\D/g, '');

    where[Op.and] = [
      {
        [Op.or]: [
          { nombre_completo: { [like]: patronContiene(q) } },
          { correo: { [like]: patronContiene(q) } },
          ...(soloDigitos ? [{ cedula_profesional: { [like]: `%${soloDigitos}%` } }] : []),
        ],
      },
    ];
  }

  const { rows, count } = await Terapeuta.findAndCountAll({
    where,
    paranoid,
    include: [incluirMetadatoFoto],
    distinct: true,
    order: [
      ['nombre_completo', 'ASC'],
      ['id', 'ASC'],
    ],
    limit: paginacion.limit,
    offset: paginacion.offset,
  });

  return respuestaPaginada(rows.map((fila) => serializar(fila)), count, paginacion);
}

async function obtener(id, contexto) {
  const terapeuta = await buscarPorId(id, { conFoto: true });
  const horarios = await TerapeutaHorario.findAll({
    where: { terapeuta_id: id },
    order: [
      ['dia_semana', 'ASC'],
      ['hora_inicio', 'ASC'],
    ],
  });

  await registrarAuditoria(
    { ...contexto, accion: 'consultar', entidad: 'terapeuta', entidadId: terapeuta.id },
    { mejorEsfuerzo: true }
  );

  return serializar(terapeuta, { horarios });
}

async function actualizar(id, cambios, contexto) {
  return conTransaccion(async (transaction) => {
    const terapeuta = await buscarPorId(id, { transaction, conFoto: true });

    if (terapeuta.baja_at) {
      throw new AppError('El terapeuta está dado de baja. Debe reactivarse antes de editarlo.', 409);
    }

    await asegurarUnicos(
      {
        correo: cambios.correo && cambios.correo !== terapeuta.correo ? cambios.correo : undefined,
        cedula_profesional:
          cambios.cedula_profesional && cambios.cedula_profesional !== terapeuta.cedula_profesional
            ? cambios.cedula_profesional
            : undefined,
      },
      { excluirId: terapeuta.id, transaction }
    );

    await terapeuta.update(cambios, { transaction });

    await registrarAuditoria(
      {
        ...contexto,
        accion: 'actualizar',
        entidad: 'terapeuta',
        entidadId: terapeuta.id,
        detalle: { campos: Object.keys(cambios).sort() },
      },
      { transaction }
    );

    return serializar(terapeuta);
  });
}

async function darDeBaja(id, contexto) {
  return conTransaccion(async (transaction) => {
    const terapeuta = await buscarPorId(id, { transaction });

    if (terapeuta.baja_at) {
      throw new AppError('El terapeuta ya está dado de baja.', 409);
    }

    await verificarBajaPermitida('terapeuta', terapeuta.id, { transaction });

    await terapeuta.update({ baja_por: contexto.usuarioId }, { transaction });
    await terapeuta.destroy({ transaction });

    await registrarAuditoria(
      { ...contexto, accion: 'baja', entidad: 'terapeuta', entidadId: terapeuta.id },
      { transaction }
    );
  });
}

async function reactivar(id, contexto) {
  return conTransaccion(async (transaction) => {
    const terapeuta = await buscarPorId(id, { transaction, conFoto: true });

    if (!terapeuta.baja_at) {
      throw new AppError('El terapeuta ya está activo.', 409);
    }

    await terapeuta.restore({ transaction });
    await terapeuta.update({ baja_por: null }, { transaction });

    await registrarAuditoria(
      { ...contexto, accion: 'reactivar', entidad: 'terapeuta', entidadId: terapeuta.id },
      { transaction }
    );

    return serializar(terapeuta);
  });
}

// ---- Foto ------------------------------------------------------------------

/**
 * Valida la imagen en el servidor (formato real, dimensiones mínimas) y la
 * normaliza a un WebP cuadrado. Nunca se confía en la extensión ni en el MIME
 * que declara el navegador.
 */
async function procesarFoto(buffer) {
  let metadatos;

  try {
    metadatos = await sharp(buffer, { limitInputPixels: MAX_PIXELES_ENTRADA }).metadata();
  } catch (error) {
    throw new AppError('El archivo no es una imagen válida.', 400, null, { foto: 'El archivo no es una imagen válida.' });
  }

  if (!FORMATOS_FOTO.has(metadatos.format)) {
    const mensaje = 'La foto debe ser JPEG, PNG o WebP.';
    throw new AppError(mensaje, 400, null, { foto: mensaje });
  }

  if (metadatos.width < FOTO_MIN_PX || metadatos.height < FOTO_MIN_PX) {
    const mensaje = `La foto debe medir al menos ${FOTO_MIN_PX}×${FOTO_MIN_PX} píxeles.`;
    throw new AppError(mensaje, 400, null, { foto: mensaje });
  }

  const salida = await sharp(buffer, { limitInputPixels: MAX_PIXELES_ENTRADA })
    .rotate()
    .resize(FOTO_SALIDA_PX, FOTO_SALIDA_PX, { fit: 'cover' })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return {
    data: salida.data,
    mime: 'image/webp',
    ancho: salida.info.width,
    alto: salida.info.height,
  };
}

async function guardarFoto(id, archivo, contexto) {
  if (!archivo || !archivo.buffer) {
    throw new AppError('Selecciona una foto para subir.', 400, null, { foto: 'Selecciona una foto para subir.' });
  }

  const procesada = await procesarFoto(archivo.buffer);

  return conTransaccion(async (transaction) => {
    const terapeuta = await buscarPorId(id, { incluirBajas: false, transaction });
    const existente = await TerapeutaFoto.findOne({ where: { terapeuta_id: terapeuta.id }, transaction });

    if (existente) {
      await existente.update(procesada, { transaction });
    } else {
      await TerapeutaFoto.create({ ...procesada, terapeuta_id: terapeuta.id }, { transaction });
    }

    await registrarAuditoria(
      {
        ...contexto,
        accion: 'actualizar',
        entidad: 'terapeuta',
        entidadId: terapeuta.id,
        detalle: { campos: ['foto'] },
      },
      { transaction }
    );

    return { ancho: procesada.ancho, alto: procesada.alto, mime: procesada.mime };
  });
}

async function obtenerFoto(id) {
  await buscarPorId(id);

  const foto = await TerapeutaFoto.findOne({ where: { terapeuta_id: id } });

  if (!foto) {
    throw new AppError('El terapeuta no tiene foto.', 404);
  }

  return foto;
}

// ---- Horarios --------------------------------------------------------------

async function obtenerHorarios(id) {
  await buscarPorId(id);

  const horarios = await TerapeutaHorario.findAll({
    where: { terapeuta_id: id },
    order: [
      ['dia_semana', 'ASC'],
      ['hora_inicio', 'ASC'],
    ],
  });

  return horarios.map(serializarHorario);
}

/** Reemplaza el horario semanal completo en una sola transacción (todo o nada). */
async function reemplazarHorarios(id, horarios, contexto, { confirmarConflictos = false } = {}) {
  return conTransaccion(async (transaction) => {
    const terapeuta = await buscarPorId(id, { incluirBajas: false, transaction });

    // Si el nuevo horario dejaría fuera citas pendientes, se avisa con sus folios y se exige confirmar.
    const afectados = await afectadosPorCambioDeHorario(terapeuta.id, horarios, { transaction });

    if (afectados.length > 0 && !confirmarConflictos) {
      throw new AppError(
        `El nuevo horario deja fuera ${afectados.length} cita(s) pendiente(s). Reprográmalas o confirma el cambio.`,
        409,
        null,
        null,
        { folios_afectados: afectados }
      );
    }

    await TerapeutaHorario.destroy({ where: { terapeuta_id: terapeuta.id }, transaction });

    const creados = await TerapeutaHorario.bulkCreate(
      horarios.map((franja) => ({ ...franja, terapeuta_id: terapeuta.id })),
      { transaction }
    );

    await registrarAuditoria(
      {
        ...contexto,
        accion: 'actualizar',
        entidad: 'terapeuta',
        entidadId: terapeuta.id,
        detalle: { campos: ['horarios'], franjas: horarios.length },
      },
      { transaction }
    );

    return creados
      .map(serializarHorario)
      .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));
  });
}

module.exports = {
  crear,
  listar,
  obtener,
  actualizar,
  darDeBaja,
  reactivar,
  procesarFoto,
  guardarFoto,
  obtenerFoto,
  obtenerHorarios,
  reemplazarHorarios,
  serializar,
};
