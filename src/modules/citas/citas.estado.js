const { Op } = require('sequelize');

/**
 * "Vencida" no es una columna: una cita pendiente cuyo término ya pasó se considera
 * vencida. Calcularlo evita tareas programadas y estados desfasados.
 *
 * `ahora` es el resultado de enClinica(): { fecha: 'YYYY-MM-DD', hora: 'HH:mm' }.
 */
function estadoEfectivo(cita, ahora) {
  if (cita.estado === 'cancelada') return 'cancelada';

  const vencida = cita.fecha < ahora.fecha || (cita.fecha === ahora.fecha && cita.hora_fin <= ahora.hora);

  return vencida ? 'vencida' : 'pendiente';
}

/** Cita que todavía no termina (para reglas de baja, cancelación, modificación). */
function condicionNoVencida(ahora) {
  return {
    [Op.or]: [{ fecha: { [Op.gt]: ahora.fecha } }, { fecha: ahora.fecha, hora_fin: { [Op.gt]: ahora.hora } }],
  };
}

function condicionVencida(ahora) {
  return {
    [Op.or]: [{ fecha: { [Op.lt]: ahora.fecha } }, { fecha: ahora.fecha, hora_fin: { [Op.lte]: ahora.hora } }],
  };
}

/** Fragmento WHERE para un filtro de estado: pendiente | vencida | cancelada | todas. */
function filtroPorEstado(estado, ahora) {
  if (estado === 'cancelada') return { estado: 'cancelada' };
  if (estado === 'pendiente') return { [Op.and]: [{ estado: 'pendiente' }, condicionNoVencida(ahora)] };
  if (estado === 'vencida') return { [Op.and]: [{ estado: 'pendiente' }, condicionVencida(ahora)] };
  return {};
}

module.exports = { estadoEfectivo, condicionNoVencida, condicionVencida, filtroPorEstado };
