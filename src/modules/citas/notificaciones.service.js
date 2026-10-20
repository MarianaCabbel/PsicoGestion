const { Op } = require('sequelize');
const { Notificacion, Cita } = require('../../config/database');
const { sendCitaEmail } = require('../../utils/email');
const { formatearFechaLarga } = require('../../lib/fechas');
const { ahora } = require('../../lib/reloj');

const MAX_INTENTOS = 5;
/** Espera antes de cada reintento: 1, 5, 15 y 60 minutos. */
const ESPERA_MINUTOS = [1, 5, 15, 60];
/** Una notificación "procesando" por más de este tiempo se considera abandonada y se reintenta. */
const TIEMPO_ABANDONO_MS = 10 * 60 * 1000;

/**
 * Registra el correo en la bandeja de salida dentro de la misma transacción de la cita.
 * Si el SMTP falla, la cita no se pierde: el worker reintenta después.
 * Devuelve null si el paciente no tiene correo.
 */
async function encolar({ tipo, citaId, paciente }, transaction) {
  if (!paciente || !paciente.correo) return null;

  return Notificacion.create(
    {
      tipo,
      cita_id: citaId,
      destinatario: paciente.correo,
      estado: 'pendiente',
      proximo_intento_at: ahora(),
    },
    { transaction }
  );
}

/** Quita direcciones de correo de los mensajes de error antes de guardarlos. */
function sanitizarError(mensaje) {
  return String(mensaje || 'Error desconocido')
    .replace(/[^\s@<>"']+@[^\s@<>"']+/g, '[correo]')
    .slice(0, 255);
}

function datosParaCorreo(cita) {
  return {
    folio: cita.folio,
    fecha_larga: formatearFechaLarga(cita.fecha),
    hora_inicio: cita.hora_inicio,
    hora_fin: cita.hora_fin,
    paciente_nombre: cita.paciente.nombre_completo,
    terapeuta_nombre: cita.terapeuta.nombre_completo,
    sala_nombre: cita.sala.nombre,
    motivo_cancelacion: cita.motivo_cancelacion,
  };
}

async function procesarUna(notificacion) {
  const cita = await Cita.findByPk(notificacion.cita_id, {
    include: [
      { association: 'paciente', paranoid: false },
      { association: 'terapeuta', paranoid: false },
      { association: 'sala', paranoid: false },
    ],
  });

  // Una confirmación o modificación pendiente de una cita ya cancelada ya no tiene sentido enviarla.
  if (!cita || (cita.estado === 'cancelada' && notificacion.tipo !== 'cancelacion')) {
    await notificacion.update({
      estado: 'omitida',
      ultimo_error: 'La cita fue cancelada antes de enviar el correo.',
    });
    return 'omitida';
  }

  const intentos = notificacion.intentos + 1;

  try {
    await sendCitaEmail({ to: notificacion.destinatario, tipo: notificacion.tipo, cita: datosParaCorreo(cita) });

    await notificacion.update({ estado: 'enviada', enviada_at: ahora(), intentos, ultimo_error: null });
    return 'enviada';
  } catch (error) {
    const ultimo_error = sanitizarError(error.message);

    if (intentos >= MAX_INTENTOS) {
      await notificacion.update({ estado: 'fallida', intentos, ultimo_error });
      return 'fallida';
    }

    const espera = ESPERA_MINUTOS[Math.min(intentos - 1, ESPERA_MINUTOS.length - 1)];
    await notificacion.update({
      estado: 'pendiente',
      intentos,
      ultimo_error,
      proximo_intento_at: new Date(ahora().getTime() + espera * 60 * 1000),
    });
    return 'reintento';
  }
}

/**
 * Toma las notificaciones vencidas y las envía. Reclama cada una con un UPDATE
 * condicional para que dos procesos no envíen el mismo correo.
 */
async function procesarPendientes({ limite = 20 } = {}) {
  const instante = ahora();
  const resumen = { enviadas: 0, reintentos: 0, fallidas: 0, omitidas: 0 };

  const candidatas = await Notificacion.findAll({
    where: {
      [Op.or]: [
        { estado: 'pendiente', proximo_intento_at: { [Op.lte]: instante } },
        { estado: 'procesando', updated_at: { [Op.lt]: new Date(instante.getTime() - TIEMPO_ABANDONO_MS) } },
      ],
    },
    order: [['id', 'ASC']],
    limit: limite,
  });

  for (const notificacion of candidatas) {
    const [reclamadas] = await Notificacion.update(
      { estado: 'procesando' },
      { where: { id: notificacion.id, estado: notificacion.estado } }
    );

    if (reclamadas !== 1) continue;

    await notificacion.reload();
    const resultado = await procesarUna(notificacion);

    if (resultado === 'enviada') resumen.enviadas += 1;
    else if (resultado === 'reintento') resumen.reintentos += 1;
    else if (resultado === 'fallida') resumen.fallidas += 1;
    else resumen.omitidas += 1;
  }

  return resumen;
}

/** Estado de la última notificación de confirmación de una cita (para mostrarlo en el detalle). */
async function ultimaConfirmacion(citaId) {
  const notificacion = await Notificacion.findOne({
    where: { cita_id: citaId, tipo: 'confirmacion' },
    order: [['id', 'DESC']],
  });

  if (!notificacion) return null;

  return {
    estado: notificacion.estado,
    intentos: notificacion.intentos,
    enviada_at: notificacion.enviada_at,
  };
}

module.exports = {
  MAX_INTENTOS,
  ESPERA_MINUTOS,
  encolar,
  procesarPendientes,
  ultimaConfirmacion,
  sanitizarError,
};
