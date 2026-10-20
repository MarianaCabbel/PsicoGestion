const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const { Sequelize } = require('sequelize');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

/**
 * Crea el ejecutor de migraciones (Umzug) para una instancia de Sequelize.
 * Recibe la instancia para poder probar las migraciones en una base aparte.
 */
function crearMigrator(sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  return new Umzug({
    migrations: {
      glob: ['*.js', { cwd: MIGRATIONS_DIR }],
      resolve: ({ name, path: migrationPath }) => {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const migration = require(migrationPath);

        return {
          name,
          up: async () => migration.up(queryInterface, Sequelize),
          down: async () => migration.down(queryInterface, Sequelize),
        };
      },
    },
    context: queryInterface,
    storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
    logger: process.env.NODE_ENV === 'test' ? undefined : console,
  });
}

module.exports = { crearMigrator, MIGRATIONS_DIR };
