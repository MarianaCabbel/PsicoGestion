const { Sequelize } = require('sequelize');
const { sequelize: sequelizeDeModelos } = require('../src/config/database');
const { crearMigrator } = require('../src/db/migrator');

function columnasDelModelo(modelo) {
  return Object.entries(modelo.rawAttributes)
    .filter(([, atributo]) => atributo.type.key !== 'VIRTUAL')
    .map(([nombre, atributo]) => ({
      columna: atributo.field || nombre,
      llavePrimaria: Boolean(atributo.primaryKey),
      permiteNulo: atributo.allowNull !== false,
    }));
}

function nuevaBase() {
  return new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, define: { underscored: true, timestamps: false } });
}

async function tablas(sequelize) {
  const lista = await sequelize.getQueryInterface().showAllTables();
  return lista.map((t) => (typeof t === 'string' ? t : t.tableName)).sort();
}

describe('Migraciones (Umzug)', () => {
  test('CP-INT-85 aplicar todas las migraciones produce el mismo esquema que los modelos', async () => {
    const base = nuevaBase();
    await crearMigrator(base).up();
    const queryInterface = base.getQueryInterface();

    for (const modelo of Object.values(sequelizeDeModelos.models)) {
      const tabla = modelo.getTableName();
      const descrita = await queryInterface.describeTable(tabla);
      const esperadas = columnasDelModelo(modelo);

      expect(Object.keys(descrita).sort()).toEqual(esperadas.map((c) => c.columna).sort());

      // SQLite describe como "nulable" a las llaves primarias enteras; se omiten de esta comparación.
      esperadas
        .filter(({ llavePrimaria }) => !llavePrimaria)
        .forEach(({ columna, permiteNulo }) => {
          expect({ tabla, columna, permiteNulo: descrita[columna].allowNull }).toEqual({ tabla, columna, permiteNulo });
        });
    }

    await base.close();
  });

  test('CP-INT-85 las migraciones se pueden revertir por completo y volver a aplicar', async () => {
    const base = nuevaBase();
    const migrator = crearMigrator(base);

    await migrator.up();
    expect(await tablas(base)).toEqual(
      expect.arrayContaining(['audit_log', 'citas', 'cita_ocupaciones', 'correos_autorizados', 'folio_counters', 'notificaciones', 'pacientes', 'salas', 'terapeuta_fotos', 'terapeuta_horarios', 'terapeutas', 'usuarios_administrativos'])
    );

    await migrator.down({ to: 0 });
    expect(await tablas(base)).toEqual(['schema_migrations']);

    await migrator.up();
    expect(await tablas(base)).toContain('pacientes');

    await base.close();
  });

  test('CP-INT-86 ejecutar up dos veces no repite migraciones', async () => {
    const base = nuevaBase();
    const migrator = crearMigrator(base);

    const primera = await migrator.up();
    const segunda = await migrator.up();

    expect(primera).toHaveLength(8);
    expect(segunda).toHaveLength(0);

    await base.close();
  });

  test('CP-INT-86 una base creada con la versión anterior (sin rol ni codigo_intentos) se actualiza sin perder usuarios', async () => {
    const base = nuevaBase();
    const queryInterface = base.getQueryInterface();

    await queryInterface.createTable('usuarios_administrativos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      nombre_completo: { type: Sequelize.STRING(50), allowNull: false },
      correo_institucional: { type: Sequelize.STRING, allowNull: false, unique: true },
      telefono: { type: Sequelize.STRING, allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING, allowNull: false },
      verificado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      codigo_verificacion: { type: Sequelize.STRING, allowNull: true },
      codigo_expira_en: { type: Sequelize.DATE, allowNull: true },
      token_version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      reset_token_hash: { type: Sequelize.STRING, allowNull: true },
      reset_token_expira_en: { type: Sequelize.DATE, allowNull: true },
    });

    await base.query(
      `INSERT INTO usuarios_administrativos (nombre_completo, correo_institucional, telefono, password_hash, verificado, reset_token_hash, reset_token_expira_en)
       VALUES ('Ana', 'ana@correo.uady.mx', '9876543210', 'hash', 1, 'token-en-claro-heredado', '2099-01-01')`
    );

    await crearMigrator(base).up();

    const [[usuario]] = await base.query('SELECT * FROM usuarios_administrativos');
    expect(usuario.correo_institucional).toBe('ana@correo.uady.mx');
    expect(usuario.rol).toBe('secretaria');
    expect(usuario.codigo_intentos).toBe(0);
    // El token que estaba en claro se invalida: ya no puede usarse.
    expect(usuario.reset_token_hash).toBeNull();
    expect(usuario.reset_token_expira_en).toBeNull();

    await base.close();
  });

  test('CP-INT-87 el esquema impide CURP duplicada y llaves foráneas huérfanas', async () => {
    const base = nuevaBase();
    await base.query('PRAGMA foreign_keys = ON');
    await crearMigrator(base).up();

    const insertar = (curp, creador = 'NULL') =>
      base.query(
        `INSERT INTO pacientes (nombre_completo, curp, sexo, fecha_nacimiento, telefono, creado_por) VALUES ('X', '${curp}', 'H', '1990-01-01', '9990000000', ${creador})`
      );

    await insertar('AAAA900101HYNRRL00');
    await expect(insertar('AAAA900101HYNRRL00')).rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError' });
    await expect(insertar('BBBB900101HYNRRL00', 999)).rejects.toMatchObject({ name: 'SequelizeForeignKeyConstraintError' });

    await base.close();
  });
});
