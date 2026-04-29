const mongoose = require('mongoose');
const logger   = require('./logger');
require('dotenv').config();

// MongoDB connection string — update MONGO_URI in a .env file for your environment
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexus_auth';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
