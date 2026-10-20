module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('terapeutas', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      nombre_completo: { type: Sequelize.STRING(100), allowNull: false },
      telefono: { type: Sequelize.STRING(10), allowNull: false },
      correo: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      fecha_nacimiento: { type: Sequelize.DATEONLY, allowNull: false },
      cedula_profesional: { type: Sequelize.STRING(8), allowNull: false, unique: true },
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

    await queryInterface.addIndex('terapeutas', ['nombre_completo'], { name: 'terapeutas_nombre_idx' });
    await queryInterface.addIndex('terapeutas', ['baja_at'], { name: 'terapeutas_baja_idx' });

    await queryInterface.createTable('terapeuta_fotos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      terapeuta_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'terapeutas', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      mime: { type: Sequelize.STRING(30), allowNull: false },
      ancho: { type: Sequelize.INTEGER, allowNull: false },
      alto: { type: Sequelize.INTEGER, allowNull: false },
      data: { type: Sequelize.BLOB('long'), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('terapeuta_horarios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      terapeuta_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'terapeutas', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      dia_semana: { type: Sequelize.INTEGER, allowNull: false },
      hora_inicio: { type: Sequelize.STRING(5), allowNull: false },
      hora_fin: { type: Sequelize.STRING(5), allowNull: false },
    });

    await queryInterface.addIndex('terapeuta_horarios', ['terapeuta_id', 'dia_semana', 'hora_inicio'], {
      unique: true,
      name: 'terapeuta_horarios_unico_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('terapeuta_horarios');
    await queryInterface.dropTable('terapeuta_fotos');
    await queryInterface.dropTable('terapeutas');
  },
};
