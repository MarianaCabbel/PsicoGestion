module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('salas', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      nombre: { type: Sequelize.STRING(10), allowNull: false },
      nombre_norm: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      creado_por: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'usuarios_administrativos', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      baja_por: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      baja_at: { type: Sequelize.DATE, allowNull: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('salas');
  },
};
