const { Op, UniqueConstraintError } = require('sequelize');
const {
  sequelize,
  Cita,
  CitaOcupacion,
  FolioCounter,
  Paciente,
  Terapeuta,
  Sala,
  TerapeutaHorario,
} = require('../../config/database');
const { AppError } = require('../../utils/errors');
const {
  DIAS_ATENCION,
  DURACION_CITA_SLOTS_DEFECTO,
  HORA_INICIO,
  HORA_FIN,
  REQUIERE_HORARIO_TERAPEUTA,
  SLOT_MINUTOS,
} = require('../../config/clinica');
const { registrarAuditoria } = require('../../lib/audit');
const { conTransaccion } = require('../../lib/transaccion');
const { calcularPaginacion, respuestaPaginada } = require('../../lib/paginacion');
const { horaAMinutos } = require('../../lib/fechas');
const { enClinica, ahora } = require('../../lib/reloj');
const { rangoDeFecha } = require('../../lib/rangos');
const {
  NUM_SLOTS,
  MINUTOS_INICIO,
  horaASlot,
  horaFinDe,
  slotsDeCita,
  minutosAHora,
  fusionarFranjas,
  diaSemanaISO,
} = require('../../lib/slots');
const { estadoEfectivo, filtroPorEstado } = require('./citas.estado');
const notificaciones = require('./notificaciones.service');

const ENTIDADES = {
  paciente: {
    modelo: Paciente,
    campo: 'paciente_id',
    noExiste: 'El paciente seleccionado no existe.',
    baja: 'El paciente seleccionado está dado de baja.',
  },
  terapeuta: {
    modelo: Terapeuta,
    campo: 'terapeuta_id',
    noExiste: 'El terapeuta seleccionado no existe.',
    baja: 'El terapeuta seleccionado está dado de baja.',
  },
  sala: {
    modelo: Sala,
    campo: 'sala_id',
    noExiste: 'La sala seleccionada no existe.',
    baja: 'La sala seleccionada está dada de baja.',
  },
};

const MENSAJES_CONFLICTO = {
  sala_id: 'La sala ya está ocupada en ese horario.',
  terapeuta_id: 'El terapeuta ya tiene una cita en ese horario.',
  paciente_id: 'El paciente ya tiene una cita en ese horario.',
};

const INCLUDES = [
  { association: 'paciente', paranoid: false, attributes: ['id', 'nombre_completo', 'telefono', 'correo'] },
  { association: 'terapeuta', paranoid: false, attributes: ['id', 'nombre_completo'] },
  { association: 'sala', paranoid: false, attributes: ['id', 'nombre'] },
];

function errorDeCampo(mensaje, campo, estado = 400) {
  return new AppError(mensaje, estado, null, { [campo]: mensaje });
}

function bloqueo(transaction) {
  return sequelize.getDialect() === 'sqlite' ? {} : { lock: transaction.LOCK.UPDATE };
}

// ---- Serialización ---------------------------------------------------------

function serializar(cita, ahoraClinica, { detalle = false } = {}) {
  const resultado = {
    id: cita.id,
    folio: cita.folio,
    estado: estadoEfectivo(cita, ahoraClinica),
    fecha: cita.fecha,
    hora_inicio: cita.hora_inicio,
    hora_fin: cita.hora_fin,
    duracion_slots: cita.duracion_slots,
    duracion_minutos: cita.duracion_slots * SLOT_MINUTOS,
    paciente: cita.paciente
      ? { id: cita.paciente.id, nombre_completo: cita.paciente.nombre_completo }
      : { id: cita.paciente_id },
    terapeuta: cita.terapeuta
      ? { id: cita.terapeuta.id, nombre_completo: cita.terapeuta.nombre_completo }
      : { id: cita.terapeuta_id },
    sala: cita.sala ? { id: cita.sala.id, nombre: cita.sala.nombre } : { id: cita.sala_id },
    motivo_cancelacion: cita.motivo_cancelacion,
    cancelada_at: cita.cancelada_at,
    created_at: cita.created_at,
    updated_at: cita.updated_at,
  };

  if (detalle && cita.paciente) {
    resultado.paciente.telefono = cita.paciente.telefono;
    resultado.paciente_tiene_correo = Boolean(cita.paciente.correo);
  }

  return resultado;
}

async function cargarCompleta(id, { transaction } = {}) {
  const cita = await Cita.findByPk(id, { include: INCLUDES, transaction });

  if (!cita) {
    throw new AppError('Cita no encontrada.', 404);
  }

  return cita;
}

// ---- Reglas de negocio -----------------------------------------------------

async function cargarActivo(clave, id, transaction) {
  const { modelo, campo, noExiste, baja } = ENTIDADES[clave];
  const entidad = await modelo.findByPk(id, { paranoid: false, transaction });

  if (!entidad) throw errorDeCampo(noExiste, campo, 404);
  if (entidad.baja_at) throw errorDeCampo(baja, campo, 409);

  return entidad;
}

async function franjasDelDia(terapeutaId, dia, transaction) {
  const horarios = await TerapeutaHorario.findAll({
    where: { terapeuta_id: terapeutaId, dia_semana: dia },
    transaction,
    raw: true,
  });

  return fusionarFranjas(
    horarios.map((h) => ({ inicio: horaAMinutos(h.hora_inicio), fin: horaAMinutos(h.hora_fin) }))
  );
}

/**
 * Reglas de calendario de una cita: no pasada, día de atención, dentro de la ventana
 * de la clínica y dentro del horario semanal del terapeuta. Devuelve slots y hora_fin.
 */
async function validarReglasDeAgenda({ fecha, hora_inicio, duracion_slots, terapeuta_id }, transaction) {
  const ahoraClinica = enClinica(ahora());

  if (fecha < ahoraClinica.fecha) {
    throw errorDeCampo('No se pueden agendar citas en fechas pasadas.', 'fecha');
  }

  const dia = diaSemanaISO(fecha);
  if (!DIAS_ATENCION.includes(dia)) {
    throw errorDeCampo('La clínica no atiende ese día de la semana.', 'fecha');
  }

  if (horaASlot(hora_inicio) === null) {
    throw errorDeCampo(
      `La hora debe estar entre ${HORA_INICIO} y ${HORA_FIN} y ser múltiplo de ${SLOT_MINUTOS} minutos.`,
      'hora_inicio'
    );
  }

  const slots = slotsDeCita(hora_inicio, duracion_slots);
  if (!slots) {
    throw errorDeCampo(`La cita terminaría después del cierre (${HORA_FIN}).`, 'duracion_slots');
  }

  if (fecha === ahoraClinica.fecha && horaAMinutos(hora_inicio) <= ahoraClinica.minutos) {
    throw errorDeCampo('La hora de la cita ya pasó.', 'hora_inicio');
  }

  if (REQUIERE_HORARIO_TERAPEUTA) {
    const franjas = await franjasDelDia(terapeuta_id, dia, transaction);

    if (franjas.length === 0) {
      throw errorDeCampo('El terapeuta no tiene horario configurado para ese día.', 'terapeuta_id');
    }

    const inicio = horaAMinutos(hora_inicio);
    const fin = inicio + duracion_slots * SLOT_MINUTOS;

    if (!franjas.some((franja) => franja.inicio <= inicio && franja.fin >= fin)) {
      throw errorDeCampo('El terapeuta no atiende en ese horario.', 'hora_inicio');
    }
  }

  return { slots, hora_fin: horaFinDe(hora_inicio, duracion_slots) };
}

/** Qué recursos (sala, terapeuta, paciente) ya están ocupados en esos bloques. */
async function detectarConflicto({ fecha, slots, sala_id, terapeuta_id, paciente_id }, transaction) {
  const filas = await CitaOcupacion.findAll({
    attributes: ['sala_id', 'terapeuta_id', 'paciente_id'],
    where: {
      fecha,
      slot: { [Op.in]: slots },
      [Op.or]: [{ sala_id }, { terapeuta_id }, { paciente_id }],
    },
    transaction,
    raw: true,
  });

  const conflicto = {};
  filas.forEach((fila) => {
    if (Number(fila.sala_id) === sala_id) conflicto.sala_id = true;
    if (Number(fila.terapeuta_id) === terapeuta_id) conflicto.terapeuta_id = true;
    if (Number(fila.paciente_id) === paciente_id) conflicto.paciente_id = true;
  });

  return Object.keys(conflicto).length > 0 ? conflicto : null;
}

function errorDeConflicto(conflicto) {
  const campos = ['sala_id', 'terapeuta_id', 'paciente_id'].filter((campo) => conflicto[campo]);
  const errores = Object.fromEntries(campos.map((campo) => [campo, MENSAJES_CONFLICTO[campo]]));

  return new AppError(MENSAJES_CONFLICTO[campos[0]], 409, null, errores);
}

/**
 * Si la base rechazó la inserción por un índice único (otra petición ganó la carrera),
 * se identifica qué recurso chocó para dar un mensaje útil.
 */
async function traducirViolacion(error, datos) {
  if (!(error instanceof UniqueConstraintError)) return error;

  const slots = slotsDeCita(datos.hora_inicio, datos.duracion_slots);
  const conflicto = slots ? await detectarConflicto({ ...datos, slots }) : null;

  if (conflicto) return errorDeConflicto(conflicto);

  return new AppError('El horario ya no está disponible. Actualiza la disponibilidad e inténtalo de nuevo.', 409);
}

function filasDeOcupacion(citaId, { fecha, sala_id, terapeuta_id, paciente_id }, slots) {
  return [...slots]
    .sort((a, b) => a - b)
    .map((slot) => ({ cita_id: citaId, fecha, slot, sala_id, terapeuta_id, paciente_id }));
}

// ---- Folio -----------------------------------------------------------------

function formatearFolio(anio, numero) {
  return `CIT-${anio}-${String(numero).padStart(6, '0')}`;
}

/**
 * Garantiza que exista la fila del contador anual, en una transacción corta propia
 * (findOrCreate maneja la carrera entre dos altas simultáneas del primer folio del año).
 * Pasa por conTransaccion para no cruzarse con otras transacciones en SQLite.
 */
async function asegurarContador(anio) {
  try {
    await conTransaccion((transaction) =>
      FolioCounter.findOrCreate({ where: { anio }, defaults: { ultimo: 0 }, transaction })
    );
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
  }
}

/**
 * Siguiente folio del año. El UPDATE incrementa de forma atómica y retiene el bloqueo
 * de la fila hasta confirmar la transacción: no hay folios repetidos y, si la cita
 * se revierte, el número también (sin huecos).
 */
async function siguienteFolio(anio, transaction) {
  await FolioCounter.increment('ultimo', { by: 1, where: { anio }, transaction });
  const contador = await FolioCounter.findByPk(anio, { transaction });

  if (!contador) {
    // Red de seguridad: la fila del contador no existía (primer folio del año).
    await FolioCounter.create({ anio, ultimo: 1 }, { transaction });
    return formatearFolio(anio, 1);
  }

  return formatearFolio(anio, contador.ultimo);
}

// ---- Operaciones -----------------------------------------------------------

async function crear(datos, contexto) {
  const duracion_slots = datos.duracion_slots ?? DURACION_CITA_SLOTS_DEFECTO;
  const completos = { ...datos, duracion_slots };
  const anio = Number(enClinica(ahora()).fecha.slice(0, 4));

  await asegurarContador(anio);

  try {
    const citaId = await conTransaccion(async (transaction) => {
      const paciente = await cargarActivo('paciente', datos.paciente_id, transaction);
      await cargarActivo('terapeuta', datos.terapeuta_id, transaction);
      await cargarActivo('sala', datos.sala_id, transaction);

      const { slots, hora_fin } = await validarReglasDeAgenda(completos, transaction);

      // Primer bloqueo de la transacción: serializa las altas y define el folio.
      const folio = await siguienteFolio(anio, transaction);

      const conflicto = await detectarConflicto({ ...completos, slots }, transaction);
      if (conflicto) throw errorDeConflicto(conflicto);

      const cita = await Cita.create(
        { ...completos, folio, hora_fin, estado: 'pendiente', creada_por: contexto.usuarioId },
        { transaction }
      );

      // Los índices únicos de cita_ocupaciones son la garantía final contra el traslape.
      await CitaOcupacion.bulkCreate(filasDeOcupacion(cita.id, completos, slots), { transaction });

      await notificaciones.encolar({ tipo: 'confirmacion', citaId: cita.id, paciente }, transaction);

      await registrarAuditoria(
        { ...contexto, accion: 'crear', entidad: 'cita', entidadId: cita.id, detalle: { folio } },
        { transaction }
      );

      return cita.id;
    });

    return await obtenerSerializada(citaId);
  } catch (error) {
    throw await traducirViolacion(error, completos);
  }
}

async function obtenerSerializada(id) {
  const cita = await cargarCompleta(id);
  const confirmacion = await notificaciones.ultimaConfirmacion(cita.id);

  return { ...serializar(cita, enClinica(ahora()), { detalle: true }), notificacion: confirmacion };
}

async function obtener(id, contexto) {
  const data = await obtenerSerializada(id);

  await registrarAuditoria(
    { ...contexto, accion: 'consultar', entidad: 'cita', entidadId: id },
    { mejorEsfuerzo: true }
  );

  return data;
}

async function obtenerPorFolio(folio, contexto) {
  const cita = await Cita.findOne({ where: { folio }, attributes: ['id'] });

  if (!cita) {
    throw new AppError('No existe una cita con ese folio.', 404);
  }

  return obtener(cita.id, contexto);
}

async function listar(filtros) {
  const ahoraClinica = enClinica(ahora());
  const paginacion = calcularPaginacion(filtros);
  const condiciones = [filtroPorEstado(filtros.estado, ahoraClinica)];

  ['sala_id', 'terapeuta_id', 'paciente_id'].forEach((campo) => {
    if (filtros[campo]) condiciones.push({ [campo]: filtros[campo] });
  });

  if (filtros.rango) {
    const { desde, hasta } = rangoDeFecha(filtros.rango, filtros.fecha);
    condiciones.push({ fecha: { [Op.between]: [desde, hasta] } });
  } else if (filtros.fecha && !filtros.desde && !filtros.hasta) {
    condiciones.push({ fecha: filtros.fecha });
  } else {
    if (filtros.desde) condiciones.push({ fecha: { [Op.gte]: filtros.desde } });
    if (filtros.hasta) condiciones.push({ fecha: { [Op.lte]: filtros.hasta } });
  }

  const direccion = filtros.orden === 'desc' ? 'DESC' : 'ASC';

  const { rows, count } = await Cita.findAndCountAll({
    where: { [Op.and]: condiciones },
    include: INCLUDES,
    distinct: true,
    order: [
      ['fecha', direccion],
      ['hora_inicio', direccion],
      ['id', direccion],
    ],
    limit: paginacion.limit,
    offset: paginacion.offset,
  });

  return respuestaPaginada(rows.map((cita) => serializar(cita, ahoraClinica)), count, paginacion);
}

async function actualizar(id, cambios, contexto) {
  const ahoraClinica = enClinica(ahora());
  let datosFinales = null;

  try {
    await conTransaccion(async (transaction) => {
      const cita = await Cita.findByPk(id, { transaction, ...bloqueo(transaction) });

      if (!cita) throw new AppError('Cita no encontrada.', 404);

      const efectivo = estadoEfectivo(cita, ahoraClinica);
      if (efectivo === 'cancelada') throw new AppError('La cita está cancelada y no puede modificarse.', 409);
      if (efectivo === 'vencida') throw new AppError('La cita ya venció y no puede modificarse.', 409);

      const actuales = {
        paciente_id: cita.paciente_id,
        terapeuta_id: cita.terapeuta_id,
        sala_id: cita.sala_id,
        fecha: cita.fecha,
        hora_inicio: cita.hora_inicio,
        duracion_slots: cita.duracion_slots,
      };
      const campos = Object.keys(cambios).filter((campo) => String(cambios[campo]) !== String(actuales[campo]));

      datosFinales = { ...actuales, ...cambios };

      // Sin cambios reales no se tocan los bloques ni se avisa al paciente.
      if (campos.length === 0) return;

      const paciente = campos.includes('paciente_id')
        ? await cargarActivo('paciente', datosFinales.paciente_id, transaction)
        : await Paciente.findByPk(cita.paciente_id, { paranoid: false, transaction });
      if (campos.includes('terapeuta_id')) await cargarActivo('terapeuta', datosFinales.terapeuta_id, transaction);
      if (campos.includes('sala_id')) await cargarActivo('sala', datosFinales.sala_id, transaction);

      const cambiaAgenda = ['fecha', 'hora_inicio', 'duracion_slots', 'terapeuta_id'].some((c) => campos.includes(c));
      let slots;
      let hora_fin = cita.hora_fin;

      if (cambiaAgenda) {
        ({ slots, hora_fin } = await validarReglasDeAgenda(datosFinales, transaction));
      } else {
        slots = slotsDeCita(datosFinales.hora_inicio, datosFinales.duracion_slots);
      }

      // Se liberan los bloques propios antes de revisar conflictos: la cita no choca consigo misma.
      await CitaOcupacion.destroy({ where: { cita_id: cita.id }, transaction });

      const conflicto = await detectarConflicto({ ...datosFinales, slots }, transaction);
      if (conflicto) throw errorDeConflicto(conflicto);

      await cita.update({ ...datosFinales, hora_fin }, { transaction });
      await CitaOcupacion.bulkCreate(filasDeOcupacion(cita.id, datosFinales, slots), { transaction });

      await notificaciones.encolar({ tipo: 'modificacion', citaId: cita.id, paciente }, transaction);

      await registrarAuditoria(
        {
          ...contexto,
          accion: 'actualizar',
          entidad: 'cita',
          entidadId: cita.id,
          detalle: { campos: [...campos].sort() },
        },
        { transaction }
      );
    });
  } catch (error) {
    throw await traducirViolacion(error, datosFinales || cambios);
  }

  return obtenerSerializada(id);
}

/** Cancela por id o por folio, libera los bloques y encola el aviso al paciente. */
async function cancelar({ id, folio }, { motivo }, contexto) {
  const ahoraClinica = enClinica(ahora());

  await conTransaccion(async (transaction) => {
    const where = id ? { id } : { folio };
    const cita = await Cita.findOne({ where, transaction, ...bloqueo(transaction) });

    if (!cita) {
      throw new AppError(id ? 'Cita no encontrada.' : 'No existe una cita con ese folio.', 404);
    }

    const efectivo = estadoEfectivo(cita, ahoraClinica);
    if (efectivo === 'cancelada') throw new AppError('La cita ya está cancelada.', 409);
    if (efectivo === 'vencida') throw new AppError('La cita ya venció y no puede cancelarse.', 409);

    const paciente = await Paciente.findByPk(cita.paciente_id, { paranoid: false, transaction });

    await cita.update(
      {
        estado: 'cancelada',
        motivo_cancelacion: motivo || null,
        cancelada_at: ahora(),
        cancelada_por: contexto.usuarioId,
      },
      { transaction }
    );

    // Liberar los bloques es lo que permite reagendar ese horario de inmediato.
    await CitaOcupacion.destroy({ where: { cita_id: cita.id }, transaction });

    await notificaciones.encolar({ tipo: 'cancelacion', citaId: cita.id, paciente }, transaction);

    await registrarAuditoria(
      {
        ...contexto,
        accion: 'cancelar',
        entidad: 'cita',
        entidadId: cita.id,
        detalle: { con_motivo: Boolean(motivo) },
      },
      { transaction }
    );
  });

  const citaId = id || (await Cita.findOne({ where: { folio }, attributes: ['id'] })).id;
  return obtenerSerializada(citaId);
}

async function reenviarConfirmacion(id, contexto) {
  const cita = await cargarCompleta(id);
  const ahoraClinica = enClinica(ahora());

  if (estadoEfectivo(cita, ahoraClinica) !== 'pendiente') {
    throw new AppError('Solo se puede reenviar la confirmación de una cita pendiente.', 409);
  }

  if (!cita.paciente || !cita.paciente.correo) {
    throw new AppError('El paciente no tiene correo registrado.', 409);
  }

  await notificaciones.encolar({ tipo: 'confirmacion', citaId: cita.id, paciente: cita.paciente });

  await registrarAuditoria(
    { ...contexto, accion: 'reenviar_confirmacion', entidad: 'cita', entidadId: cita.id },
    { mejorEsfuerzo: true }
  );

  return { notificacion: await notificaciones.ultimaConfirmacion(cita.id) };
}

/**
 * Horas de inicio válidas para agendar: dentro del horario del terapeuta, sin traslapes
 * de terapeuta ni paciente y con al menos una sala libre. Alimenta el selector del formulario.
 */
async function disponibilidad({ fecha, terapeuta_id, paciente_id, duracion_slots, excluir_cita_id }) {
  const duracion = duracion_slots ?? DURACION_CITA_SLOTS_DEFECTO;
  const ahoraClinica = enClinica(ahora());
  const respuesta = { fecha, duracion_slots: duracion, slot_minutos: SLOT_MINUTOS, inicios: [] };

  await cargarActivo('terapeuta', terapeuta_id);
  if (paciente_id) await cargarActivo('paciente', paciente_id);

  if (fecha < ahoraClinica.fecha) return { ...respuesta, motivo: 'La fecha ya pasó.' };

  const dia = diaSemanaISO(fecha);
  if (!DIAS_ATENCION.includes(dia)) return { ...respuesta, motivo: 'La clínica no atiende ese día de la semana.' };

  const franjas = await franjasDelDia(terapeuta_id, dia);
  if (REQUIERE_HORARIO_TERAPEUTA && franjas.length === 0) {
    return { ...respuesta, motivo: 'El terapeuta no tiene horario configurado para ese día.' };
  }

  const salas = await Sala.findAll({ order: [['nombre_norm', 'ASC'], ['id', 'ASC']] });
  if (salas.length === 0) return { ...respuesta, motivo: 'No hay salas activas.' };

  const filtroDimension = [{ terapeuta_id }, { sala_id: { [Op.in]: salas.map((s) => s.id) } }];
  if (paciente_id) filtroDimension.push({ paciente_id });

  const where = { fecha, [Op.or]: filtroDimension };
  if (excluir_cita_id) where.cita_id = { [Op.ne]: excluir_cita_id };

  const ocupaciones = await CitaOcupacion.findAll({
    attributes: ['slot', 'sala_id', 'terapeuta_id', 'paciente_id'],
    where,
    raw: true,
  });

  const slotsTerapeuta = new Set();
  const slotsPaciente = new Set();
  const slotsPorSala = new Map(salas.map((sala) => [sala.id, new Set()]));

  ocupaciones.forEach((fila) => {
    const slot = Number(fila.slot);
    if (Number(fila.terapeuta_id) === terapeuta_id) slotsTerapeuta.add(slot);
    if (paciente_id && Number(fila.paciente_id) === paciente_id) slotsPaciente.add(slot);
    const deSala = slotsPorSala.get(Number(fila.sala_id));
    if (deSala) deSala.add(slot);
  });

  const libre = (conjunto, desde) =>
    Array.from({ length: duracion }, (_, i) => desde + i).every((slot) => !conjunto.has(slot));

  for (let inicio = 0; inicio + duracion <= NUM_SLOTS; inicio += 1) {
    const minutosInicio = MINUTOS_INICIO + inicio * SLOT_MINUTOS;
    const minutosFin = minutosInicio + duracion * SLOT_MINUTOS;

    const dentroDeHorario =
      !REQUIERE_HORARIO_TERAPEUTA || franjas.some((f) => f.inicio <= minutosInicio && f.fin >= minutosFin);
    const yaPaso = fecha === ahoraClinica.fecha && minutosInicio <= ahoraClinica.minutos;

    if (!dentroDeHorario || yaPaso) continue;
    if (!libre(slotsTerapeuta, inicio) || (paciente_id && !libre(slotsPaciente, inicio))) continue;

    const salasLibres = salas
      .filter((sala) => libre(slotsPorSala.get(sala.id), inicio))
      .map((sala) => ({ id: sala.id, nombre: sala.nombre }));

    if (salasLibres.length > 0) {
      respuesta.inicios.push({
        hora_inicio: minutosAHora(minutosInicio),
        hora_fin: minutosAHora(minutosFin),
        salas_libres: salasLibres,
      });
    }
  }

  return respuesta;
}

module.exports = {
  crear,
  obtener,
  obtenerPorFolio,
  listar,
  actualizar,
  cancelar,
  reenviarConfirmacion,
  disponibilidad,
  formatearFolio,
};
