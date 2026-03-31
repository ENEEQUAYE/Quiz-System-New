const app = require('./app');
const connectDB = require('./config/db');

module.exports = async (req, res) => {
  try {
    const path = req.url || '';
    const method = req.method || '';

    if (path === '/health' || method === 'OPTIONS') {
      return app(req, res);
    }

    await connectDB();
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