const { AppError } = require('../utils/errors');

/**
 * Registro de reglas que pueden impedir una baja lógica (por ejemplo, "tiene
 * citas pendientes futuras"). Los módulos que dependen de pacientes, terapeutas
 * o salas registran su regla aquí sin que estos servicios los conozcan.
 *
 * Una regla es una función async (id, { transaction }) que devuelve un mensaje
 * de motivo si la baja debe bloquearse, o null/undefined si puede continuar.
 */
const reglas = {
  paciente: [],
  terapeuta: [],
  sala: [],
};

function registrarBajaGuard(entidad, regla) {
  if (!reglas[entidad]) {
    throw new Error(`Entidad desconocida para baja guard: ${entidad}`);
  }
  reglas[entidad].push(regla);
}

function limpiarBajaGuards() {
  Object.keys(reglas).forEach((entidad) => {
    reglas[entidad] = [];
  });
}

async function verificarBajaPermitida(entidad, id, opciones = {}) {
  for (const regla of reglas[entidad] || []) {
    const motivo = await regla(id, opciones);
    if (motivo) {
      throw new AppError(motivo, 409);
    }
  }
}

module.exports = { registrarBajaGuard, limpiarBajaGuards, verificarBajaPermitida };
