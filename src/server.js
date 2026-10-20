require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./config/database');
const { crearMigrator } = require('./db/migrator');
const { assertEnvironment, isProduction } = require('./config/env');
const { iniciarWorkerDeNotificaciones } = require('./jobs/notificacionesWorker');

// El frontend (Next.js) usa el 3000, así que el backend vive en el 4000.
const PORT = process.env.PORT || 4000;

/** En desarrollo se migra al arrancar; en producción solo si se pide expresamente. */
function debeMigrarAlArrancar() {
  const configurado = process.env.DB_AUTO_MIGRATE;

  if (configurado === 'true') return true;
  if (configurado === 'false') return false;
  return !isProduction();
}

async function iniciar() {
  assertEnvironment();

  await sequelize.authenticate();

  if (debeMigrarAlArrancar()) {
    await crearMigrator(sequelize).up();
  }

  const servidor = app.listen(PORT, () => {
    console.log(`Servidor PsicoGestión escuchando en http://localhost:${PORT}`);
  });

  // Envía los correos de citas pendientes (NOTIFICACIONES_WORKER=false lo desactiva).
  const worker = process.env.NOTIFICACIONES_WORKER === 'false' ? null : iniciarWorkerDeNotificaciones();

  const apagar = (senal) => {
    console.log(`Recibida ${senal}; cerrando el servidor.`);
    if (worker) worker.detener();
    servidor.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));
}

iniciar().catch((error) => {
  console.error('Error al iniciar el servidor:', error.message);
  process.exit(1);
});
