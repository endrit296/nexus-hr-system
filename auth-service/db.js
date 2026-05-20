const mongoose = require('mongoose');
const logger   = require('./logger');
const { getRequiredEnv } = require('./config');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(getRequiredEnv('MONGODB_URI'));
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
