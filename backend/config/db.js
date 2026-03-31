const mongoose = require('mongoose');

let cachedConnection = null;
let connectionPromise = null;

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 20000,
      connectTimeoutMS: 10000
    });
  }

  try {
    cachedConnection = await connectionPromise;
    return cachedConnection;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

module.exports = connectDB;