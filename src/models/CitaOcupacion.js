/**
 * Una fila por bloque de 30 minutos que ocupa una cita. Los tres índices
 * ÚNICOS son la garantía final contra el traslape: aunque dos peticiones
 * lleguen al mismo tiempo, la base de datos rechaza la segunda.
 */
module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'CitaOcupacion',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      cita_id: { type: DataTypes.INTEGER, allowNull: false },
      fecha: { type: DataTypes.DATEONLY, allowNull: false },
      slot: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
      sala_id: { type: DataTypes.INTEGER, allowNull: false },
      terapeuta_id: { type: DataTypes.INTEGER, allowNull: false },
      paciente_id: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      tableName: 'cita_ocupaciones',
      timestamps: false,
      indexes: [
        { unique: true, name: 'cita_ocupaciones_sala_uq', fields: ['sala_id', 'fecha', 'slot'] },
        { unique: true, name: 'cita_ocupaciones_terapeuta_uq', fields: ['terapeuta_id', 'fecha', 'slot'] },
        { unique: true, name: 'cita_ocupaciones_paciente_uq', fields: ['paciente_id', 'fecha', 'slot'] },
        { name: 'cita_ocupaciones_cita_idx', fields: ['cita_id'] },
      ],
    }
  );
