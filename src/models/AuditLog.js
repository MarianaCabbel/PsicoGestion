module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id: { type: DataTypes.INTEGER, allowNull: true },
      accion: { type: DataTypes.STRING(40), allowNull: false },
      entidad: { type: DataTypes.STRING(40), allowNull: false },
      entidad_id: { type: DataTypes.INTEGER, allowNull: true },
      /** Nunca contiene datos personales: solo nombres de campos y metadatos. */
      detalle: { type: DataTypes.JSON, allowNull: true },
      ip: { type: DataTypes.STRING(64), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: 'audit_log', timestamps: false }
  );
