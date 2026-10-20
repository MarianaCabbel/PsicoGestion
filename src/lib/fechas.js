const { ZONA_HORARIA } = require('../config/clinica');

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Fecha actual (YYYY-MM-DD) en la zona horaria de la clínica (respeta el reloj fijado en pruebas). */
function hoyEnClinica(instante = require('./reloj').ahora()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

function esFechaValida(valor) {
  if (!FORMATO_FECHA.test(String(valor || ''))) return false;

  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

/** Edad cumplida en años a la fecha `hoy` (ambas YYYY-MM-DD). */
function edadEnAnios(fechaNacimiento, hoy = hoyEnClinica()) {
  const [anioNac, mesNac, diaNac] = fechaNacimiento.split('-').map(Number);
  const [anioHoy, mesHoy, diaHoy] = hoy.split('-').map(Number);

  let edad = anioHoy - anioNac;
  if (mesHoy < mesNac || (mesHoy === mesNac && diaHoy < diaNac)) {
    edad -= 1;
  }

  return edad;
}

function esHoraValida(valor) {
  return FORMATO_HORA.test(String(valor || ''));
}

/** "07:30" -> 450 */
function horaAMinutos(valor) {
  const [horas, minutos] = valor.split(':').map(Number);
  return horas * 60 + minutos;
}

/** "2026-10-20" -> "martes, 20 de octubre de 2026" (sin depender de la zona del servidor). */
function formatearFechaLarga(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);

  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

module.exports = {
  formatearFechaLarga,
  hoyEnClinica,
  esFechaValida,
  edadEnAnios,
  esHoraValida,
  horaAMinutos,
};
