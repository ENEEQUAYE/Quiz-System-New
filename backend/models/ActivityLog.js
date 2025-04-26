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
    required: true,
    maxlength: 500 // Limit description to 500 characters
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

// Add indexes for better query performance
ActivityLogSchema.index({ action: 1 });
ActivityLogSchema.index({ performedBy: 1 });
ActivityLogSchema.index({ createdAt: -1 });

// Add a virtual field for displaying the target
ActivityLogSchema.virtual('target').get(function() {
  return this.targetUser || this.targetQuiz || 'N/A';
});

// Add a static method for creating logs
ActivityLogSchema.statics.createLog = async function(action, description, performedBy, targetUser = null, targetQuiz = null) {
  return this.create({
    action,
    description,
    performedBy,
    targetUser,
    targetQuiz
  });
};

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);