const mongoose = require('mongoose');
const logger   = require('./logger');
const { getMongoDbUri } = require('./config');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(getMongoDbUri());
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
