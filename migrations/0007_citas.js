const referencia = (tabla, onDelete) => ({
  references: { model: tabla, key: 'id' },
  onDelete,
  onUpdate: 'CASCADE',
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('citas', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      folio: { type: Sequelize.STRING(16), allowNull: false, unique: true },
      paciente_id: { type: Sequelize.INTEGER, allowNull: false, ...referencia('pacientes', 'RESTRICT') },
      terapeuta_id: { type: Sequelize.INTEGER, allowNull: false, ...referencia('terapeutas', 'RESTRICT') },
      sala_id: { type: Sequelize.INTEGER, allowNull: false, ...referencia('salas', 'RESTRICT') },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      hora_inicio: { type: Sequelize.STRING(5), allowNull: false },
      hora_fin: { type: Sequelize.STRING(5), allowNull: false },
      duracion_slots: { type: Sequelize.INTEGER, allowNull: false },
      estado: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'pendiente' },
      motivo_cancelacion: { type: Sequelize.STRING(255), allowNull: true },
      cancelada_at: { type: Sequelize.DATE, allowNull: true },
      cancelada_por: { type: Sequelize.INTEGER, allowNull: true },
      creada_por: { type: Sequelize.INTEGER, allowNull: true, ...referencia('usuarios_administrativos', 'SET NULL') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('citas', ['fecha', 'sala_id'], { name: 'citas_fecha_sala_idx' });
    await queryInterface.addIndex('citas', ['fecha', 'terapeuta_id'], { name: 'citas_fecha_terapeuta_idx' });
    await queryInterface.addIndex('citas', ['paciente_id', 'fecha'], { name: 'citas_paciente_fecha_idx' });
    await queryInterface.addIndex('citas', ['estado', 'fecha'], { name: 'citas_estado_fecha_idx' });

    await queryInterface.createTable('cita_ocupaciones', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      cita_id: { type: Sequelize.INTEGER, allowNull: false, ...referencia('citas', 'CASCADE') },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      slot: { type: Sequelize.INTEGER, allowNull: false },
      sala_id: { type: Sequelize.INTEGER, allowNull: false, ...referencia('salas', 'RESTRICT') },
      terapeuta_id: { type: Sequelize.INTEGER, allowNull: false, ...referencia('terapeutas', 'RESTRICT') },
      paciente_id: { type: Sequelize.INTEGER, allowNull: false, ...referencia('pacientes', 'RESTRICT') },
    });

    // Garantía anti-traslape a nivel de base de datos: un recurso no puede estar en dos citas a la vez.
    await queryInterface.addIndex('cita_ocupaciones', ['sala_id', 'fecha', 'slot'], {
      unique: true,
      name: 'cita_ocupaciones_sala_uq',
    });
    await queryInterface.addIndex('cita_ocupaciones', ['terapeuta_id', 'fecha', 'slot'], {
      unique: true,
      name: 'cita_ocupaciones_terapeuta_uq',
    });
    await queryInterface.addIndex('cita_ocupaciones', ['paciente_id', 'fecha', 'slot'], {
      unique: true,
      name: 'cita_ocupaciones_paciente_uq',
    });
    await queryInterface.addIndex('cita_ocupaciones', ['cita_id'], { name: 'cita_ocupaciones_cita_idx' });

    await queryInterface.createTable('folio_counters', {
      anio: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false },
      ultimo: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('folio_counters');
    await queryInterface.dropTable('cita_ocupaciones');
    await queryInterface.dropTable('citas');
  },
};
