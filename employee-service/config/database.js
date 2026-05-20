const { Sequelize } = require('sequelize');
const logger        = require('../logger');
require('dotenv').config();

const DB_URL = process.env.DATABASE_URL;

const DB_NAME = process.env.DB_NAME || 'nexus_hr';
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;

const isProduction = process.env.NODE_ENV === 'production';

const dialectOptions = isProduction ? {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
} : {};

let sequelize;

if (DB_URL) {
  sequelize = new Sequelize(DB_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions
  });
} else {
  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions
  });
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL connected successfully');
  } catch (error) {
    logger.error(`PostgreSQL connection error: ${error.message}`);
  }
};

module.exports = { sequelize, connectDB };
