//backend/models/ActivityLog.js
const mongoose = require('mongoose');
const Notification = require('./Notification'); // Make sure this path is correct

const ActivityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      // Admin actions
      'student_approval', 'quiz_created', 'quiz_assigned', 'quiz_deleted', 'quiz_updated', 'notification_sent', 'system_event',
      // Shared actions
      'user_login', 'submission_created', 'submission_graded',
      // Student actions
      'quiz_attempted', 'profile_updated', 'question_asked'
    ],
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

// Add a static method for logging activity and sending notification
ActivityLogSchema.statics.logWithNotification = async function({
  action,
  description,
  performedBy,
  targetUser = null,
  targetQuiz = null,
  notificationTitle = "",
  notificationMessage = "",
  notificationType = "system"
}) {
  const activity = await this.create({
    action,
    description,
    performedBy,
    targetUser,
    targetQuiz
  });

  // Only create notification if targetUser and notificationTitle/message are provided
  if (targetUser && notificationTitle && notificationMessage) {
    await Notification.create({
      user: targetUser,
      title: notificationTitle,
      message: notificationMessage,
      type: notificationType,
      relatedEntity: targetQuiz,
      relatedEntityModel: targetQuiz ? "Quiz" : undefined,
    });
  }

  return activity;
};

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);