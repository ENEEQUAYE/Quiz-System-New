const app = require('./app');
const connectDB = require('./config/db');

module.exports = async (req, res) => {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};