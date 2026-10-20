const notificaciones = require('../modules/citas/notificaciones.service');

/**
 * Envía periódicamente los correos de citas pendientes. Se arranca desde
 * server.js (no desde app.js) para no interferir con las pruebas de la API.
 */
function iniciarWorkerDeNotificaciones({ intervaloMs = 15000 } = {}) {
  let ejecutando = false;

  const temporizador = setInterval(async () => {
    if (ejecutando) return; // evita solapar corridas si una tarda más que el intervalo

    ejecutando = true;
    try {
      await notificaciones.procesarPendientes();
    } catch (error) {
      console.error(`[notificaciones] Error al procesar la bandeja de salida: ${error.message}`);
    } finally {
      ejecutando = false;
    }
  }, intervaloMs);

  temporizador.unref();

  return { detener: () => clearInterval(temporizador) };
}

module.exports = { iniciarWorkerDeNotificaciones };
