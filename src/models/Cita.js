module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Cita',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      folio: { type: DataTypes.STRING(16), allowNull: false, unique: true },
      paciente_id: { type: DataTypes.INTEGER, allowNull: false },
      terapeuta_id: { type: DataTypes.INTEGER, allowNull: false },
      sala_id: { type: DataTypes.INTEGER, allowNull: false },
      fecha: { type: DataTypes.DATEONLY, allowNull: false },
      hora_inicio: { type: DataTypes.STRING(5), allowNull: false },
      /** Se guarda derivada para poder comparar "vencida" directamente en SQL. */
      hora_fin: { type: DataTypes.STRING(5), allowNull: false },
      duracion_slots: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      /** Estado registrado. "vencida" no se guarda: se calcula a partir de fecha y hora_fin. */
      estado: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: 'pendiente',
        validate: { isIn: [['pendiente', 'cancelada']] },
      },
      motivo_cancelacion: { type: DataTypes.STRING(255), allowNull: true },
      cancelada_at: { type: DataTypes.DATE, allowNull: true },
      cancelada_por: { type: DataTypes.INTEGER, allowNull: true },
      creada_por: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'citas',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['fecha', 'sala_id'] },
        { fields: ['fecha', 'terapeuta_id'] },
        { fields: ['paciente_id', 'fecha'] },
        { fields: ['estado', 'fecha'] },
      ],
    }
  );
