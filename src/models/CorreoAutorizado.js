module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'CorreoAutorizado',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      correo: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: 'correos_autorizados', timestamps: false }
  );
