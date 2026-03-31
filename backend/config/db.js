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
    connectionPromise = mongoose.connect(process.env.MONGODB_URI);
  }

  cachedConnection = await connectionPromise;
  return cachedConnection;
}

module.exports = connectDB;