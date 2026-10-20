module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pacientes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      nombre_completo: { type: Sequelize.STRING(100), allowNull: false },
      curp: { type: Sequelize.STRING(18), allowNull: false, unique: true },
      sexo: { type: Sequelize.STRING(1), allowNull: false },
      fecha_nacimiento: { type: Sequelize.DATEONLY, allowNull: false },
      telefono: { type: Sequelize.STRING(10), allowNull: false },
      correo: { type: Sequelize.STRING(150), allowNull: true },
      consentimiento_at: { type: Sequelize.DATE, allowNull: true },
      aviso_version: { type: Sequelize.STRING(20), allowNull: true },
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

    await queryInterface.addIndex('pacientes', ['nombre_completo'], { name: 'pacientes_nombre_idx' });
    await queryInterface.addIndex('pacientes', ['telefono'], { name: 'pacientes_telefono_idx' });
    await queryInterface.addIndex('pacientes', ['baja_at'], { name: 'pacientes_baja_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pacientes');
  },
};
