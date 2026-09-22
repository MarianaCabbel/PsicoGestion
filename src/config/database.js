const { Sequelize, DataTypes } = require('sequelize');

const isTestEnvironment = process.env.NODE_ENV === 'test';

const sequelize = isTestEnvironment
  ? new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })
  : new Sequelize(process.env.DB_NAME || 'psicogestion', process.env.DB_USER || 'root', process.env.DB_PASSWORD || '', {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: process.env.DB_DIALECT || 'mysql',
      logging: false,
      define: {
        underscored: true,
        timestamps: false,
      },
    });

const User = require('../models/User')(sequelize, DataTypes);

module.exports = { sequelize, User };
