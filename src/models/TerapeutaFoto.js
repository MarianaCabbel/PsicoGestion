module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'TerapeutaFoto',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      terapeuta_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      mime: { type: DataTypes.STRING(30), allowNull: false },
      ancho: { type: DataTypes.INTEGER, allowNull: false },
      alto: { type: DataTypes.INTEGER, allowNull: false },
      data: { type: DataTypes.BLOB('long'), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'terapeuta_fotos',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );
