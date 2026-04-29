const { Sequelize } = require('sequelize');
const logger        = require('../logger');
require('dotenv').config();

// PostgreSQL connection string — update these values in a .env file
const DB_NAME = process.env.DB_NAME || 'nexus_hr';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASS = process.env.DB_PASS || 'password';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false, // Set to console.log to see SQL queries during development
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL connected successfully');
  } catch (error) {
    logger.error(`PostgreSQL connection error: ${error.message}`);
  }
};

module.exports = { sequelize, connectDB };
