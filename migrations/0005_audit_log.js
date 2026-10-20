module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_log', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'usuarios_administrativos', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      accion: { type: Sequelize.STRING(40), allowNull: false },
      entidad: { type: Sequelize.STRING(40), allowNull: false },
      entidad_id: { type: Sequelize.INTEGER, allowNull: true },
      detalle: { type: Sequelize.JSON, allowNull: true },
      ip: { type: Sequelize.STRING(64), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('audit_log', ['entidad', 'entidad_id'], { name: 'audit_log_entidad_idx' });
    await queryInterface.addIndex('audit_log', ['usuario_id'], { name: 'audit_log_usuario_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_log');
  },
};
