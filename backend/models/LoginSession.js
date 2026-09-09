const mongoose = require('mongoose');

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lastActivityAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

schema.statics.IDLE_MS = IDLE_MS;
schema.statics.ABSOLUTE_MS = ABSOLUTE_MS;
schema.statics.activeFilter = function(id, user, now = new Date()) {
  return {
    _id: id, user,
    expiresAt: { $gt: now },
    lastActivityAt: { $gt: new Date(now.getTime() - IDLE_MS) }
  };
};
schema.methods.clientState = function() {
  return {
    serverNow: Date.now(),
    idleExpiresAt: this.lastActivityAt.getTime() + IDLE_MS,
    expiresAt: this.expiresAt.getTime()
  };
};

module.exports = mongoose.model('LoginSession', schema);
