const { Op, UniqueConstraintError, fn, col } = require('sequelize');
const { Sala, Cita, CitaOcupacion } = require('../../config/database');
const { AppError } = require('../../utils/errors');
const { DIAS_ATENCION } = require('../../config/clinica');
const { registrarAuditoria } = require('../../lib/audit');
const { conTransaccion } = require('../../lib/transaccion');
const { verificarBajaPermitida } = require('../../lib/bajaGuards');
const { calcularPaginacion, respuestaPaginada, operadorLike, patronContiene } = require('../../lib/paginacion');
const { NUM_SLOTS, horaASlot, slotAHora, diaSemanaISO } = require('../../lib/slots');
const { fechasEntre } = require('../../lib/rangos');
const { enClinica, ahora } = require('../../lib/reloj');

/** "  Sala Ñandú " -> "sala nandu": base de la unicidad del nombre. */
function normalizarNombre(nombre) {
  return String(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function serializar(sala, extra = {}) {
  return {
    id: sala.id,
    nombre: sala.nombre,
    estado: sala.estado,
    created_at: sala.created_at,
    baja_at: sala.baja_at,
    ...extra,
  };
}

async function buscarPorId(id, { incluirBajas = true, transaction } = {}) {
  const sala = await Sala.findByPk(id, { paranoid: !incluirBajas, transaction });

  if (!sala) {
    throw new AppError('Sala no encontrada.', 404);
  }

  return sala;
}

function errorNombreDuplicado(existente) {
  const mensaje = existente.baja_at
    ? 'Existe una sala dada de baja con ese nombre. Solicita su reactivación a un administrador.'
    : 'Ya existe una sala con ese nombre.';

  return new AppError(mensaje, 409, null, { nombre: mensaje });
}

async function crear({ nombre }, contexto) {
  const nombre_norm = normalizarNombre(nombre);
  const existente = await Sala.findOne({ where: { nombre_norm }, paranoid: false });

  if (existente) throw errorNombreDuplicado(existente);

  try {
    return await conTransaccion(async (transaction) => {
      const sala = await Sala.create({ nombre, nombre_norm, creado_por: contexto.usuarioId }, { transaction });

      await registrarAuditoria(
        { ...contexto, accion: 'crear', entidad: 'sala', entidadId: sala.id },
        { transaction }
      );

      return serializar(sala);
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new AppError('Ya existe una sala con ese nombre.', 409, null, { nombre: 'Ya existe una sala con ese nombre.' });
    }
    throw error;
  }
}

/** Para cada sala: citas pendientes de hoy y si está ocupada en este momento. */
async function estadoDeHoy(salaIds) {
  if (salaIds.length === 0) return new Map();

  const { fecha, minutos } = enClinica(ahora());
  const resultado = new Map(salaIds.map((id) => [id, { citas_hoy: 0, ocupada_ahora: false }]));

  const conteos = await Cita.findAll({
    attributes: ['sala_id', [fn('COUNT', col('id')), 'total']],
    where: { sala_id: { [Op.in]: salaIds }, fecha, estado: 'pendiente' },
    group: ['sala_id'],
    raw: true,
  });
  conteos.forEach((fila) => {
    resultado.get(Number(fila.sala_id)).citas_hoy = Number(fila.total);
  });

  const horaActual = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  const slotActual = horaASlot(slotRedondeado(horaActual));

  if (slotActual !== null) {
    const ocupadas = await CitaOcupacion.findAll({
      attributes: ['sala_id'],
      where: { sala_id: { [Op.in]: salaIds }, fecha, slot: slotActual },
      raw: true,
    });
    ocupadas.forEach((fila) => {
      resultado.get(Number(fila.sala_id)).ocupada_ahora = true;
    });
  }

  return resultado;
}

/** Baja la hora al inicio de su bloque de 30 minutos ("08:47" -> "08:30"). */
function slotRedondeado(hora) {
  const [h, m] = hora.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${m >= 30 ? '30' : '00'}`;
}

async function listar({ q, estado, page, limit }) {
  const paginacion = calcularPaginacion({ page, limit });
  const where = {};
  let paranoid = true;

  if (estado === 'baja') {
    paranoid = false;
    where.baja_at = { [Op.ne]: null };
  } else if (estado === 'todas') {
    paranoid = false;
  }

  if (q) {
    where.nombre = { [operadorLike()]: patronContiene(q) };
  }

  const { rows, count } = await Sala.findAndCountAll({
    where,
    paranoid,
    order: [
      ['nombre_norm', 'ASC'],
      ['id', 'ASC'],
    ],
    limit: paginacion.limit,
    offset: paginacion.offset,
  });

  const hoy = await estadoDeHoy(rows.map((sala) => sala.id));

  return respuestaPaginada(rows.map((sala) => serializar(sala, hoy.get(sala.id))), count, paginacion);
}

async function obtener(id, contexto) {
  const sala = await buscarPorId(id);
  const hoy = await estadoDeHoy([sala.id]);

  await registrarAuditoria(
    { ...contexto, accion: 'consultar', entidad: 'sala', entidadId: sala.id },
    { mejorEsfuerzo: true }
  );

  return serializar(sala, hoy.get(sala.id));
}

async function darDeBaja(id, contexto) {
  return conTransaccion(async (transaction) => {
    const sala = await buscarPorId(id, { transaction });

    if (sala.baja_at) {
      throw new AppError('La sala ya está dada de baja.', 409);
    }

    await verificarBajaPermitida('sala', sala.id, { transaction });

    await sala.update({ baja_por: contexto.usuarioId }, { transaction });
    await sala.destroy({ transaction });

    await registrarAuditoria(
      { ...contexto, accion: 'baja', entidad: 'sala', entidadId: sala.id },
      { transaction }
    );
  });
}

async function reactivar(id, contexto) {
  return conTransaccion(async (transaction) => {
    const sala = await buscarPorId(id, { transaction });

    if (!sala.baja_at) {
      throw new AppError('La sala ya está activa.', 409);
    }

    await sala.restore({ transaction });
    await sala.update({ baja_por: null }, { transaction });

    await registrarAuditoria(
      { ...contexto, accion: 'reactivar', entidad: 'sala', entidadId: sala.id },
      { transaction }
    );

    return serializar(sala);
  });
}

/** Mapa de bloques de un día para cada sala activa: qué horas están ocupadas y cuáles libres. */
async function disponibilidadDelDia(fecha) {
  const salas = await Sala.findAll({ order: [['nombre_norm', 'ASC'], ['id', 'ASC']] });
  const ocupaciones = salas.length
    ? await CitaOcupacion.findAll({
        attributes: ['sala_id', 'slot'],
        where: { fecha, sala_id: { [Op.in]: salas.map((s) => s.id) } },
        order: [['slot', 'ASC']],
        raw: true,
      })
    : [];

  const porSala = new Map(salas.map((sala) => [sala.id, new Set()]));
  ocupaciones.forEach((fila) => porSala.get(Number(fila.sala_id)).add(Number(fila.slot)));

  return {
    fecha,
    dia_atencion: DIAS_ATENCION.includes(diaSemanaISO(fecha)),
    num_slots: NUM_SLOTS,
    salas: salas.map((sala) => {
      const ocupados = [...porSala.get(sala.id)];

      return {
        id: sala.id,
        nombre: sala.nombre,
        ocupados,
        horas_ocupadas: ocupados.map(slotAHora),
        libres: NUM_SLOTS - ocupados.length,
      };
    }),
  };
}

/** Por día: libre (0 bloques ocupados), parcial o reservada (todos los bloques ocupados). */
async function disponibilidadDeRango(id, { desde, hasta }) {
  const sala = await buscarPorId(id);

  const conteos = await CitaOcupacion.findAll({
    attributes: ['fecha', [fn('COUNT', col('id')), 'total']],
    where: { sala_id: sala.id, fecha: { [Op.between]: [desde, hasta] } },
    group: ['fecha'],
    raw: true,
  });
  const porFecha = new Map(conteos.map((fila) => [String(fila.fecha).slice(0, 10), Number(fila.total)]));

  return {
    sala: { id: sala.id, nombre: sala.nombre },
    desde,
    hasta,
    num_slots: NUM_SLOTS,
    dias: fechasEntre(desde, hasta).map((fecha) => {
      const ocupados = porFecha.get(fecha) || 0;

      return {
        fecha,
        dia_atencion: DIAS_ATENCION.includes(diaSemanaISO(fecha)),
        slots_ocupados: ocupados,
        estado: ocupados === 0 ? 'libre' : ocupados >= NUM_SLOTS ? 'reservada' : 'parcial',
      };
    }),
  };
}

module.exports = {
  normalizarNombre,
  crear,
  listar,
  obtener,
  darDeBaja,
  reactivar,
  disponibilidadDelDia,
  disponibilidadDeRango,
};
