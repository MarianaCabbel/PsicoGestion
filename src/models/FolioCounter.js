module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'FolioCounter',
    {
      anio: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
      ultimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'folio_counters', timestamps: false }
  );
