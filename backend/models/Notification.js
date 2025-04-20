const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['system', 'message', 'alert', 'approval'],
    default: 'system'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  relatedEntity: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedEntityModel'
  },
  relatedEntityModel: {
    type: String,
    enum: ['User', 'Quiz', 'Submission']
  },
  metadata: {
    type: Object
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster querying
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

// Static methods
NotificationSchema.statics = {
  /**
   * Create a new notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Notification>}
   */
  async createNotification(notificationData) {
    const notification = new this(notificationData);
    await notification.save();
    return notification;
  },

  /**
   * Mark notifications as read
   * @param {String} userId - User ID
   * @param {Array} notificationIds - Array of notification IDs
   * @returns {Promise<Object>} - Update result
   */
  async markAsRead(userId, notificationIds) {
    return this.updateMany(
      {
        _id: { $in: notificationIds },
        user: userId
      },
      { $set: { isRead: true } }
    );
  }
};

// Instance methods
NotificationSchema.methods = {
  /**
   * Format notification for client
   * @returns {Object} - Formatted notification
   */
  formatForClient() {
    return {
      id: this._id,
      title: this.title,
      message: this.message,
      type: this.type,
      isRead: this.isRead,
      createdAt: this.createdAt,
      relatedEntity: this.relatedEntity,
      metadata: this.metadata
    };
  }
};

module.exports = mongoose.model('Notification', NotificationSchema);