module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Terapeuta',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      nombre_completo: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true, len: [2, 100] },
      },
      telefono: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: { is: /^\d{10}$/ },
      },
      correo: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      fecha_nacimiento: { type: DataTypes.DATEONLY, allowNull: false },
      cedula_profesional: {
        type: DataTypes.STRING(8),
        allowNull: false,
        unique: true,
        validate: { is: /^\d{7,8}$/ },
      },
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
      tableName: 'terapeutas',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'baja_at',
      indexes: [{ fields: ['nombre_completo'] }],
    }
  );
