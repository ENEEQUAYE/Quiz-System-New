//backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
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

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token
UserSchema.methods.generateAuthToken = async function() {
  const token = jwt.sign(
    { _id: this._id.toString(), role: this.role, status: this.status },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // Token expiration time
  );
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