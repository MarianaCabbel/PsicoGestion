module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'TerapeutaHorario',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      terapeuta_id: { type: DataTypes.INTEGER, allowNull: false },
      dia_semana: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1, max: 7 },
      },
      hora_inicio: { type: DataTypes.STRING(5), allowNull: false },
      hora_fin: { type: DataTypes.STRING(5), allowNull: false },
    },
    {
      tableName: 'terapeuta_horarios',
      timestamps: false,
      indexes: [
        { unique: true, fields: ['terapeuta_id', 'dia_semana', 'hora_inicio'] },
      ],
    }
  );
