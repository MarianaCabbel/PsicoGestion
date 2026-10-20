const { sequelize } = require('../config/database');

// SQLite (solo desarrollo y pruebas) tiene una única conexión de escritura:
// las transacciones se encolan para que no se anidan ni se bloqueen entre sí.
let cola = Promise.resolve();

const CODIGOS_REINTENTABLES = new Set(['40P01', '40001']); // deadlock / fallo de serialización (PostgreSQL)
const MAX_REINTENTOS = 3;

async function ejecutar(fn) {
  for (let intento = 1; ; intento += 1) {
    try {
      return await sequelize.transaction(fn);
    } catch (error) {
      const codigo = error && error.parent && error.parent.code;

      if (!CODIGOS_REINTENTABLES.has(codigo) || intento >= MAX_REINTENTOS) {
        throw error;
      }
    }
  }
}

/**
 * Ejecuta `fn(transaction)` dentro de una transacción. En PostgreSQL/MySQL se
 * reintenta ante deadlocks; en SQLite se serializa.
 */
function conTransaccion(fn) {
  if (sequelize.getDialect() !== 'sqlite') {
    return ejecutar(fn);
  }

  const corrida = cola.then(() => ejecutar(fn));
  cola = corrida.catch(() => undefined);
  return corrida;
}

module.exports = { conTransaccion };
