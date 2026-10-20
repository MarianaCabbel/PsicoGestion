module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Paciente',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      nombre_completo: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true, len: [2, 100] },
      },
      curp: {
        type: DataTypes.STRING(18),
        allowNull: false,
        unique: true,
        validate: { len: [18, 18] },
      },
      sexo: {
        type: DataTypes.STRING(1),
        allowNull: false,
        validate: { isIn: [['H', 'M', 'X']] },
      },
      fecha_nacimiento: { type: DataTypes.DATEONLY, allowNull: false },
      telefono: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: { is: /^\d{10}$/ },
      },
      correo: {
        type: DataTypes.STRING(150),
        allowNull: true,
        validate: { isEmail: true },
      },
      consentimiento_at: { type: DataTypes.DATE, allowNull: true },
      aviso_version: { type: DataTypes.STRING(20), allowNull: true },
      creado_por: { type: DataTypes.INTEGER, allowNull: true },
      baja_por: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      baja_at: { type: DataTypes.DATE, allowNull: true },
      estado: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('baja_at') ? 'baja' : 'activo';
        },
      },
    },
    {
      tableName: 'pacientes',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'baja_at',
      indexes: [{ fields: ['nombre_completo'] }, { fields: ['telefono'] }],
    }
  );
