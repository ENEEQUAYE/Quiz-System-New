const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const LoginSession = require('../models/LoginSession');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Please sign in.', code: 'SESSION_EXPIRED' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Tokens issued before server-backed sessions cannot be refreshed.
    if (!mongoose.isValidObjectId(decoded.sid) || !mongoose.isValidObjectId(decoded._id)) {
      return res.status(401).json({ error: 'Please sign in again.', code: 'SESSION_EXPIRED' });
    }
    const session = await LoginSession.findOne(LoginSession.activeFilter(decoded.sid, decoded._id));
    if (!session) return res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    const user = await User.findById(decoded._id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Your account is not active.', code: 'SESSION_EXPIRED' });
    }
    req.token = token;
    req.user = user;
    req.loginSession = session;
    next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    }
    console.error('Session verification failed:', error);
    return res.status(503).json({ error: 'Unable to verify your session. Please retry.' });
  }
};
module.exports = auth;
