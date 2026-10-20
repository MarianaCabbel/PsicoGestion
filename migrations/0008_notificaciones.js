module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notificaciones', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      tipo: { type: Sequelize.STRING(20), allowNull: false },
      cita_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'citas', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      destinatario: { type: Sequelize.STRING(150), allowNull: false },
      estado: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'pendiente' },
      intentos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      proximo_intento_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      ultimo_error: { type: Sequelize.STRING(255), allowNull: true },
      enviada_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('notificaciones', ['estado', 'proximo_intento_at'], {
      name: 'notificaciones_cola_idx',
    });
    await queryInterface.addIndex('notificaciones', ['cita_id'], { name: 'notificaciones_cita_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notificaciones');
  },
};
