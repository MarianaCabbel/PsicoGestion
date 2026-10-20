function aFecha(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function aTexto(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(texto, dias) {
  const fecha = aFecha(texto);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aTexto(fecha);
}

/**
 * Rango [desde, hasta] (inclusive) que contiene la fecha dada.
 *  - dia: la misma fecha.
 *  - semana: lunes a domingo.
 *  - mes: del día 1 al último día del mes.
 */
function rangoDeFecha(rango, fecha) {
  if (rango === 'dia') {
    return { desde: fecha, hasta: fecha };
  }

  if (rango === 'semana') {
    const diaJs = aFecha(fecha).getUTCDay();
    const desplazamiento = diaJs === 0 ? 6 : diaJs - 1;
    const desde = sumarDias(fecha, -desplazamiento);
    return { desde, hasta: sumarDias(desde, 6) };
  }

  if (rango === 'mes') {
    const base = aFecha(fecha);
    const primero = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
    return { desde: aTexto(primero), hasta: aTexto(ultimo) };
  }

  throw new Error(`Rango desconocido: ${rango}`);
}

/** Lista de fechas YYYY-MM-DD entre desde y hasta (inclusive). */
function fechasEntre(desde, hasta) {
  const fechas = [];

  for (let actual = desde; actual <= hasta; actual = sumarDias(actual, 1)) {
    fechas.push(actual);
  }

  return fechas;
}

function diasEntre(desde, hasta) {
  return Math.round((aFecha(hasta) - aFecha(desde)) / 86400000) + 1;
}

module.exports = { rangoDeFecha, fechasEntre, sumarDias, diasEntre };
