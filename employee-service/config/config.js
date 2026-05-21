require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const useSsl = isProduction && process.env.DB_SSL === 'true';

const dialectOptions = useSsl ? {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
} : {};

const config = process.env.DATABASE_URL
  ? {
      url: process.env.DATABASE_URL,
      dialect: 'postgres',
      dialectOptions
    }
  : {
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME || 'nexus_hr',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      dialectOptions
    };

module.exports = {
  development: config,
  test: config,
  production: config
};
