const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

// Get notification counts
router.get('/counts', auth, async (req, res) => {
    try {
        const [messages, alerts] = await Promise.all([
            Message.countDocuments({
                recipients: req.user._id,
                isRead: false
            }),
            Notification.countDocuments({
                user: req.user._id,
                isRead: false
            })
        ]);
        
        res.json({ messages, alerts });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get notification counts' });
    }
});

// Get all notifications for the logged-in user
router.get('/', auth, async (req, res) => {
    try {
      const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
  
      res.json({ success: true, notifications });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
  });

module.exports = router;