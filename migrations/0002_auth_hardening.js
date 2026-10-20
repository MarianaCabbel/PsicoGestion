/**
 * Endurecimiento de autenticación:
 *  - usuarios_administrativos.rol (secretaria | administrador)
 *  - usuarios_administrativos.codigo_intentos (tope de 3 intentos por código)
 *  - correos_autorizados (lista blanca de registro)
 *  - los tokens de recuperación vigentes se invalidan: estaban guardados en claro
 *    y ahora la columna reset_token_hash contiene una huella SHA-256.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columnas = await queryInterface.describeTable('usuarios_administrativos');

    if (!columnas.rol) {
      await queryInterface.addColumn('usuarios_administrativos', 'rol', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'secretaria',
      });
    }

    if (!columnas.codigo_intentos) {
      await queryInterface.addColumn('usuarios_administrativos', 'codigo_intentos', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    await queryInterface.bulkUpdate(
      'usuarios_administrativos',
      { reset_token_hash: null, reset_token_expira_en: null },
      {}
    );

    await queryInterface.createTable('correos_autorizados', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      correo: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('correos_autorizados');
    await queryInterface.removeColumn('usuarios_administrativos', 'codigo_intentos');
    await queryInterface.removeColumn('usuarios_administrativos', 'rol');
  },
};
