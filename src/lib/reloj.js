const { ZONA_HORARIA } = require('../config/clinica');

let instanteFijo = null;

/**
 * Fuente única de "ahora". En pruebas se puede fijar con fijarAhora() para que las
 * reglas de fecha y hora sean deterministas, sin tocar temporizadores globales.
 */
function ahora() {
  return instanteFijo ? new Date(instanteFijo.getTime()) : new Date();
}

/** Solo disponible en pruebas: fija (o libera, con null) el instante actual. */
function fijarAhora(instante) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('fijarAhora solo puede usarse en el entorno de pruebas.');
  }

  instanteFijo = instante ? new Date(instante) : null;
}

/** Fecha (YYYY-MM-DD) y hora (HH:mm) de un instante en la zona horaria de la clínica. */
function enClinica(instante = ahora()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(instante)
    .reduce((acumulado, parte) => ({ ...acumulado, [parte.type]: parte.value }), {});

  const hora = `${partes.hour}:${partes.minute}`;

  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora,
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

module.exports = { ahora, fijarAhora, enClinica };
