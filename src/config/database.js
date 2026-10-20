const { Sequelize, DataTypes } = require('sequelize');

const isTestEnvironment = process.env.NODE_ENV === 'test';
const dialect = process.env.DB_DIALECT || 'sqlite';

/**
 * Opciones comunes a todos los entornos (incluido el de pruebas) para que el
 * esquema que prueban los tests sea el mismo que corre en producción.
 */
const sharedDefine = {
  underscored: true,
  timestamps: false,
};

const DEFAULT_PORTS = { mysql: 3306, mariadb: 3306, postgres: 5432 };

function buildSequelize() {
  if (isTestEnvironment && process.env.TEST_DATABASE_URL) {
    // Permite ejecutar la misma suite contra PostgreSQL (por ejemplo, en CI).
    return new Sequelize(process.env.TEST_DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      define: sharedDefine,
    });
  }

  if (isTestEnvironment) {
    return new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      define: sharedDefine,
    });
  }

  if (dialect === 'sqlite') {
    return new Sequelize({
      dialect: 'sqlite',
      storage: process.env.DB_SQLITE_STORAGE || './psicogestion.sqlite',
      logging: false,
      define: sharedDefine,
    });
  }

  return new Sequelize(
    process.env.DB_NAME || 'psicogestion',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || DEFAULT_PORTS[dialect] || 3306,
      dialect,
      logging: false,
      define: sharedDefine,
      dialectOptions:
        process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    }
  );
}

const sequelize = buildSequelize();

const User = require('../models/User')(sequelize, DataTypes);
const CorreoAutorizado = require('../models/CorreoAutorizado')(sequelize, DataTypes);
const AuditLog = require('../models/AuditLog')(sequelize, DataTypes);
const Paciente = require('../models/Paciente')(sequelize, DataTypes);
const Terapeuta = require('../models/Terapeuta')(sequelize, DataTypes);
const TerapeutaFoto = require('../models/TerapeutaFoto')(sequelize, DataTypes);
const TerapeutaHorario = require('../models/TerapeutaHorario')(sequelize, DataTypes);
const Sala = require('../models/Sala')(sequelize, DataTypes);
const Cita = require('../models/Cita')(sequelize, DataTypes);
const CitaOcupacion = require('../models/CitaOcupacion')(sequelize, DataTypes);
const FolioCounter = require('../models/FolioCounter')(sequelize, DataTypes);
const Notificacion = require('../models/Notificacion')(sequelize, DataTypes);

// Relaciones e integridad referencial.
User.hasMany(Paciente, { foreignKey: 'creado_por', onDelete: 'SET NULL' });
Paciente.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });

User.hasMany(Terapeuta, { foreignKey: 'creado_por', onDelete: 'SET NULL' });
Terapeuta.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });

User.hasMany(AuditLog, { foreignKey: 'usuario_id', onDelete: 'SET NULL' });
AuditLog.belongsTo(User, { foreignKey: 'usuario_id' });

Terapeuta.hasOne(TerapeutaFoto, { foreignKey: 'terapeuta_id', as: 'foto', onDelete: 'CASCADE' });
TerapeutaFoto.belongsTo(Terapeuta, { foreignKey: 'terapeuta_id' });

Terapeuta.hasMany(TerapeutaHorario, {
  foreignKey: 'terapeuta_id',
  as: 'horarios',
  onDelete: 'CASCADE',
});
TerapeutaHorario.belongsTo(Terapeuta, { foreignKey: 'terapeuta_id' });

User.hasMany(Sala, { foreignKey: 'creado_por', onDelete: 'SET NULL' });
Sala.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });

// Las citas conservan su historia: no se puede borrar físicamente un paciente,
// terapeuta o sala que ya tuvo citas (ON DELETE RESTRICT).
Paciente.hasMany(Cita, { foreignKey: 'paciente_id', onDelete: 'RESTRICT' });
Cita.belongsTo(Paciente, { foreignKey: 'paciente_id', as: 'paciente' });

Terapeuta.hasMany(Cita, { foreignKey: 'terapeuta_id', onDelete: 'RESTRICT' });
Cita.belongsTo(Terapeuta, { foreignKey: 'terapeuta_id', as: 'terapeuta' });

Sala.hasMany(Cita, { foreignKey: 'sala_id', onDelete: 'RESTRICT' });
Cita.belongsTo(Sala, { foreignKey: 'sala_id', as: 'sala' });

User.hasMany(Cita, { foreignKey: 'creada_por', onDelete: 'SET NULL' });
Cita.belongsTo(User, { foreignKey: 'creada_por', as: 'creador' });

Cita.hasMany(CitaOcupacion, { foreignKey: 'cita_id', as: 'ocupaciones', onDelete: 'CASCADE' });
CitaOcupacion.belongsTo(Cita, { foreignKey: 'cita_id' });

Sala.hasMany(CitaOcupacion, { foreignKey: 'sala_id', onDelete: 'RESTRICT' });
Terapeuta.hasMany(CitaOcupacion, { foreignKey: 'terapeuta_id', onDelete: 'RESTRICT' });
Paciente.hasMany(CitaOcupacion, { foreignKey: 'paciente_id', onDelete: 'RESTRICT' });

Cita.hasMany(Notificacion, { foreignKey: 'cita_id', as: 'notificaciones', onDelete: 'CASCADE' });
Notificacion.belongsTo(Cita, { foreignKey: 'cita_id', as: 'cita' });

module.exports = {
  sequelize,
  User,
  CorreoAutorizado,
  AuditLog,
  Paciente,
  Terapeuta,
  TerapeutaFoto,
  TerapeutaHorario,
  Sala,
  Cita,
  CitaOcupacion,
  FolioCounter,
  Notificacion,
};
