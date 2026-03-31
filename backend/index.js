const app = require('./app');
const connectDB = require('./config/db');

function withTimeout(promise, timeoutMs, message) {
  let timer;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

module.exports = async (req, res) => {
  try {
    const path = req.url || '';
    const method = req.method || '';
    const isHealthCheck = path === '/health' || path === '/api/health' || path.endsWith('/health');

    if (isHealthCheck || method === 'OPTIONS') {
      return app(req, res);
    }

    await withTimeout(connectDB(), 4500, 'Database connection timed out');
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', {
      message: error.message,
      stack: error.stack,
      path: req.url,
      method: req.method
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};