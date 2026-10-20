module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nombre_completo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 50],
        },
      },
      correo_institucional: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
          notEmpty: true,
        },
      },
      telefono: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      rol: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'secretaria',
        validate: {
          isIn: [['secretaria', 'administrador']],
        },
      },
      verificado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      codigo_verificacion: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      codigo_expira_en: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      codigo_intentos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      token_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      /** SHA-256 (hex) del token de recuperación; el token en claro solo viaja por correo. */
      reset_token_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      reset_token_expira_en: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'usuarios_administrativos',
      timestamps: false,
    }
  );

  return User;
};
