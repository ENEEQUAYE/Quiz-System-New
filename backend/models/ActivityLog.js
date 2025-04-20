//backend/models/ActivityLog.js
const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['student_approval', 'quiz_created', 'quiz_assigned', 'user_login', 'system_event']
  },
  description: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  targetQuiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz'
  }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);