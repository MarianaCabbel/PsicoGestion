/**
 * Reglas que se consultan antes de reemplazar el horario semanal de un terapeuta.
 * Una regla es async (terapeutaId, franjas, { transaction }) y devuelve la lista
 * de elementos afectados (por ejemplo, citas futuras que quedarían fuera del
 * nuevo horario), o un arreglo vacío si el cambio no afecta a nadie.
 */
const reglas = [];

function registrarCambioHorarioGuard(regla) {
  reglas.push(regla);
}

function limpiarCambioHorarioGuards() {
  reglas.length = 0;
}

async function afectadosPorCambioDeHorario(terapeutaId, franjas, opciones = {}) {
  const afectados = [];

  for (const regla of reglas) {
    afectados.push(...(await regla(terapeutaId, franjas, opciones)));
  }

  return afectados;
}

module.exports = { registrarCambioHorarioGuard, limpiarCambioHorarioGuards, afectadosPorCambioDeHorario };
