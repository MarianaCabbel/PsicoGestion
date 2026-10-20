/**
 * Línea base: tabla de usuarios del módulo de autenticación (Iteración 1).
 * Es idempotente: en instalaciones creadas antes con sequelize.sync() la tabla
 * ya existe y no se toca; las columnas nuevas llegan en la migración 0002.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existe = await queryInterface
      .showAllTables()
      .then((tablas) => tablas.map((t) => (typeof t === 'string' ? t : t.tableName)))
      .then((tablas) => tablas.includes('usuarios_administrativos'));

    if (existe) return;

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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('usuarios_administrativos');
  },
};
