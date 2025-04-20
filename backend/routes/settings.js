const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');

// Get user settings
router.get('/', auth, async (req, res) => {
    try {
        res.json({
            notificationSettings: req.user.settings.notifications || {},
            displaySettings: req.user.settings.display || {},
            securitySettings: req.user.settings.security || {}
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings
router.patch('/', auth, async (req, res) => {
    try {
        const { notificationSettings, displaySettings, securitySettings } = req.body;
        const updates = {};
        
        if (notificationSettings) updates['settings.notifications'] = notificationSettings;
        if (displaySettings) updates['settings.display'] = displaySettings;
        if (securitySettings) updates['settings.security'] = securitySettings;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updates },
            { new: true }
        );

        res.json(user.settings);
    } catch (error) {
        res.status(400).json({ error: 'Failed to update settings' });
    }
});

// Change password
router.post('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await req.user.changePassword(currentPassword, newPassword);
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;