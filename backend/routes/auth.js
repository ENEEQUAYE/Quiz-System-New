// backend/routes/auth.js
const express = require('express');
const router = express.Router();
// const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// Register
router.post('/register', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    
    // For admin registration, auto-approve
    if (user.role === 'admin') {
      user.status = 'active';
      await user.save();
    }
    
    const token = await user.generateAuthToken();
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(400).json(error);
  }
});

// Login
router.post('/login', async (req, res) => {
  console.log(req.body); // Log the request body
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid login credentials' });
    }

    const isMatch = await user.comparePassword(req.body.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid login credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account not approved yet' });
    }

    const token = await user.generateAuthToken();
    res.json({
      token,
      user: {
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        position: user.position,
        role: user.role,
        status: user.status,
        profilePicture: user.profilePicture,
        phone: user.phone,
        approvedBy: user.approvedBy,
        approvedAt: user.approvedAt,
        quizzesAllowed: user.quizzesAllowed,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error(error); // Log the error
    res.status(400).json(error);
  }
});

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(token => token.token !== req.token);
    await req.user.save();
    res.json();
  } catch (error) {
    res.status(500).json();
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

module.exports = router;