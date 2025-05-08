//backend/routes/user.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
router.get("/", auth, async (req, res) => {
  try {
    const users = await User.find().sort("-createdAt");

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not fetch users",
      error: error.message,
    });
  }
});

// @desc    Get pending students with pagination
// @route   GET /api/users/pending
// @access  Private (Admin)
router.get('/pending', auth, async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Pagination and search
    const { page = 1, search = '' } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {
      role: 'student',
      status: 'pending',
      $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    };

    // Query data
    const [students, total] = await Promise.all([
      User.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .select('firstName lastName email phone status'),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      approvals: students,  // Frontend expects this key
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

//Get total pending students
router.get('/pending/count', auth, async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    // Query data
    const total = await User.countDocuments({ role: 'student', status: 'pending' });
    res.json({
      success: true,
      totalPendingStudents: total
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Update student approval status
// @route   PUT /api/users/:id/status
// @access  Private (Admin)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'rejected']; // Matches your model enum

    // Validate
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status must be "active" or "rejected"' 
      });
    }

    // Update
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        approvedBy: req.user._id,
        approvedAt: Date.now()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: `Student ${status === 'active' ? 'approved' : 'rejected'}`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Create a new admin
// @route   POST /api/users/admin
// @access  Private (Admin only)
router.post("/admin", auth, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, position } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide all required fields",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long",
      });
    }

    // Check if the email already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        error: "User already exists",
      });
    }

    // Create a new admin
    user = new User({
      firstName,
      lastName,
      email,
      password,
      phone: phone || undefined,
      position: position || undefined,
      role: "admin",
      status: "active",
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        position: user.position,
      },
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
router.delete("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting self
    if (req.user.id === user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    // Prevent deleting other admins
    if (user.role === "admin" && req.user.id !== user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete other administrators",
      });
    }

    await user.remove();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not delete user",
      error: error.message,
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put("/profile", auth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, position } = req.body;

    // Validate input
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName, email, phone, position },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        position: user.position,
      },
    });
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not update profile",
      error: error.message,
    });
  }
  });

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            user: req.user,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Could not fetch user data',
            error: error.message,
        });
    }
});

module.exports = router;  