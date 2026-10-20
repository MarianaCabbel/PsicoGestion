module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Sala',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: { notEmpty: true, len: [1, 10] },
      },
      /** Nombre sin acentos ni mayúsculas: garantiza unicidad "Sala A" = "sala a". */
      nombre_norm: { type: DataTypes.STRING(10), allowNull: false, unique: true },
      creado_por: { type: DataTypes.INTEGER, allowNull: true },
      baja_por: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      baja_at: { type: DataTypes.DATE, allowNull: true },
      estado: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('baja_at') ? 'baja' : 'activa';
        },
      },
    },
    {
      tableName: 'salas',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'baja_at',
    }
  );
