const { SLOT_MINUTOS, HORA_INICIO, HORA_FIN } = require('../config/clinica');
const { horaAMinutos } = require('./fechas');

const MINUTOS_INICIO = horaAMinutos(HORA_INICIO);
const MINUTOS_FIN = horaAMinutos(HORA_FIN);

/** Cantidad de bloques de atención por día (07:00–19:00 a 30 min = 24). */
const NUM_SLOTS = (MINUTOS_FIN - MINUTOS_INICIO) / SLOT_MINUTOS;

function minutosAHora(minutos) {
  const horas = String(Math.floor(minutos / 60)).padStart(2, '0');
  const resto = String(minutos % 60).padStart(2, '0');
  return `${horas}:${resto}`;
}

/** "07:30" -> 1. Devuelve null si la hora cae fuera de la ventana o no es múltiplo del bloque. */
function horaASlot(hora) {
  const minutos = horaAMinutos(hora);

  if (minutos < MINUTOS_INICIO || minutos >= MINUTOS_FIN) return null;
  if ((minutos - MINUTOS_INICIO) % SLOT_MINUTOS !== 0) return null;

  return (minutos - MINUTOS_INICIO) / SLOT_MINUTOS;
}

/** 1 -> "07:30" */
function slotAHora(slot) {
  return minutosAHora(MINUTOS_INICIO + slot * SLOT_MINUTOS);
}

/** Hora de término de una cita que inicia en `horaInicio` y dura `duracionSlots` bloques. */
function horaFinDe(horaInicio, duracionSlots) {
  return minutosAHora(horaAMinutos(horaInicio) + duracionSlots * SLOT_MINUTOS);
}

/**
 * Bloques que ocupa una cita. Devuelve null si no cabe en la ventana de atención
 * (inicio inválido o término posterior al cierre).
 */
function slotsDeCita(horaInicio, duracionSlots) {
  const inicio = horaASlot(horaInicio);

  if (inicio === null || !Number.isInteger(duracionSlots) || duracionSlots < 1) return null;
  if (inicio + duracionSlots > NUM_SLOTS) return null;

  return Array.from({ length: duracionSlots }, (_, indice) => inicio + indice);
}

/** Une franjas contiguas o traslapadas: [{ini, fin}] en minutos -> franjas mínimas ordenadas. */
function fusionarFranjas(franjas) {
  const ordenadas = [...franjas].sort((a, b) => a.inicio - b.inicio);
  const resultado = [];

  ordenadas.forEach((franja) => {
    const ultima = resultado[resultado.length - 1];

    if (ultima && franja.inicio <= ultima.fin) {
      ultima.fin = Math.max(ultima.fin, franja.fin);
    } else {
      resultado.push({ ...franja });
    }
  });

  return resultado;
}

/** Día ISO (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD, sin depender de la zona del servidor. */
function diaSemanaISO(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const diaJs = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return diaJs === 0 ? 7 : diaJs;
}

module.exports = {
  NUM_SLOTS,
  MINUTOS_INICIO,
  MINUTOS_FIN,
  minutosAHora,
  horaASlot,
  slotAHora,
  horaFinDe,
  slotsDeCita,
  fusionarFranjas,
  diaSemanaISO,
};
