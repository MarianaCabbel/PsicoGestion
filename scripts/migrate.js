require('dotenv').config();

const { sequelize } = require('../src/config/database');
const { crearMigrator } = require('../src/db/migrator');

/** Uso: node scripts/migrate.js [up|down|status] */
async function main() {
  const comando = process.argv[2] || 'up';
  const migrator = crearMigrator(sequelize);

  try {
    await sequelize.authenticate();

    if (comando === 'up') {
      const ejecutadas = await migrator.up();
      console.log(`Migraciones aplicadas: ${ejecutadas.length}`);
    } else if (comando === 'down') {
      const revertidas = await migrator.down();
      console.log(`Migraciones revertidas: ${revertidas.length}`);
    } else if (comando === 'status') {
      const aplicadas = (await migrator.executed()).map((m) => m.name);
      const pendientes = (await migrator.pending()).map((m) => m.name);
      console.log('Aplicadas:', aplicadas.length ? aplicadas.join(', ') : '(ninguna)');
      console.log('Pendientes:', pendientes.length ? pendientes.join(', ') : '(ninguna)');
    } else {
      throw new Error(`Comando desconocido: ${comando}. Usa up, down o status.`);
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error('Error en la migración:', error.message);
  process.exit(1);
});
