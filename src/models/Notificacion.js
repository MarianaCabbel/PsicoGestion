module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Notificacion',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      tipo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [['confirmacion', 'modificacion', 'cancelacion']] },
      },
      cita_id: { type: DataTypes.INTEGER, allowNull: false },
      destinatario: { type: DataTypes.STRING(150), allowNull: false },
      estado: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: 'pendiente',
        validate: { isIn: [['pendiente', 'procesando', 'enviada', 'fallida', 'omitida']] },
      },
      intentos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      proximo_intento_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      ultimo_error: { type: DataTypes.STRING(255), allowNull: true },
      enviada_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'notificaciones',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [{ fields: ['estado', 'proximo_intento_at'] }, { fields: ['cita_id'] }],
    }
  );
