//backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const LoginSession = require('./LoginSession');

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  role: { type: String, enum: ['admin', 'student'], default: 'student' },
  status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
  profilePicture: { type: String, default: '' },
  phone: { type: String, default: '' },
  position: { type: String, default: '' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  quizzesAllowed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }],
  createdAt: { type: Date, default: Date.now }
});

// Also protect newly created or explicitly selected documents when serialized.
UserSchema.set('toJSON', {
  transform(doc, result) {
    delete result.password;
    delete result.resetPasswordToken;
    delete result.resetPasswordExpires;
    return result;
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (typeof candidatePassword !== 'string') return false;
  const hash = this.password || (await this.constructor.findById(this._id).select('+password'))?.password;
  return typeof hash === 'string' && await bcrypt.compare(candidatePassword, hash);
};

// Method to generate JWT token
UserSchema.methods.generateAuthToken = async function() {
  const now = new Date();
  const session = new LoginSession({
    user: this._id, lastActivityAt: now,
    expiresAt: new Date(now.getTime() + LoginSession.ABSOLUTE_MS)
  });
  const token = jwt.sign(
    { _id: this._id.toString(), sid: session._id.toString(), role: this.role, status: this.status },
    process.env.JWT_SECRET, { expiresIn: LoginSession.ABSOLUTE_MS / 1000 }
  );
  await session.save();
  return token;
};

UserSchema.methods.updateSettings = async function(settings) {
  this.settings = { ...this.settings, ...settings };
  await this.save();
  return this;
};

UserSchema.methods.changePassword = async function(currentPassword, newPassword) {
  const isMatch = await this.comparePassword(currentPassword);
  if (!isMatch) {
      throw new Error('Current password is incorrect');
  }
  this.password = newPassword;
  await this.save();
  return this;
};

module.exports = mongoose.model('User', UserSchema);