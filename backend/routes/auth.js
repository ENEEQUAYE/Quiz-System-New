// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
// const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const { sendMail } = require('../utils/mailer');

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

    // If student, record that admins should be notified (email disabled)
    // Email sending was removed to avoid SMTP issues on hosting platforms.
    // You can review admin notifications in the admin dashboard instead.

    const token = await user.generateAuthToken();
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(400).json(error);
  }
});

// Login
router.post('/login', async (req, res) => {
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

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });

    // Always return a generic response to prevent account enumeration.
    const genericResponse = {
      message: 'If an account exists for that email, a reset link has been sent.'
    };

    if (!user) {
      return res.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 15; // 15 minutes
    await user.save();

    const frontendBase = (process.env.FRONTEND_URL || req.headers.origin || '').replace(/\/$/, '');
    const resetUrl = `${frontendBase || 'http://localhost:5502'}/reset-password.html?token=${resetToken}`;

    await sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Use this link to reset your password: ${resetUrl}. This link expires in 15 minutes.`,
      html: `
        <p>You requested a password reset.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>This link expires in 15 minutes.</p>
      `
    });

    return res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
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