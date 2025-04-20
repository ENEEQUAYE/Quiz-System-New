const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const User = require('../models/User');

// Get all messages for current user
router.get('/', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id },
        { recipients: req.user._id }
      ]
    })
    .sort('-createdAt')
    .populate('sender', 'firstName lastName email')
    .populate('recipients', 'firstName lastName email');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send new message
router.post('/', auth, async (req, res) => {
  try {
    const { recipients, subject, body } = req.body;

    // Validate recipients
    const recipientUsers = await User.find({ 
      _id: { $in: recipients },
      role: { $in: ['admin', 'teacher'] } // Only allow sending to staff
    });

    if (recipientUsers.length !== recipients.length) {
      return res.status(400).json({ error: 'Invalid recipient(s)' });
    }

    const message = new Message({
      sender: req.user._id,
      recipients,
      subject,
      body
    });

    await message.save();
    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({ error: 'Failed to send message' });
  }
});

// Mark message as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.id,
        recipients: req.user._id
      },
      { isRead: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update message' });
  }
});

// Archive message
router.patch('/:id/archive', auth, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [
          { sender: req.user._id },
          { recipients: req.user._id }
        ]
      },
      { isArchived: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    res.status(400).json({ error: 'Failed to archive message' });
  }
});

module.exports = router;