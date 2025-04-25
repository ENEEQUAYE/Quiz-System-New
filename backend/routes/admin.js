//backend/routes/admin.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/role');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Submission = require('../models/Submission');
const ActivityLog = require('../models/ActivityLog');

// Apply auth and admin role middleware to all routes
router.use(auth);
router.use(role('admin'));

/**
 * Approval Management Endpoints
 */

// Get pending approvals with pagination
router.get('/approvals', [
  check('page').optional().isInt({ min: 1 }).toInt(),
  check('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    const [students, count] = await Promise.all([
      User.find({ status: 'pending', role: 'student' })
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .select('firstName lastName email phone status createdAt'),
      User.countDocuments({ status: 'pending', role: 'student' })
    ]);

    res.json({
      success: true,
      data: students,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch pending approvals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending approvals'
    });
  }
});

// Approve/reject student
router.patch('/approvals/:id', [
  check('status').isIn(['active', 'pending', 'rejected']).withMessage('Invalid status'),
  check('id').isMongoId().withMessage('Invalid student ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student'
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    student.status = req.body.status;
    if (req.body.status === 'active') {
      student.approvedBy = req.user._id;
      student.approvedAt = new Date();
    }

    await student.save();

    // Log approval activity
    await ActivityLog.create({
      action: 'student_approval',
      description: `${req.user.firstName} ${req.user.lastName} ${req.body.status === 'active' ? 'approved' : 'rejected'} student ${student.firstName} ${student.lastName}`,
      performedBy: req.user._id,
      targetUser: student._id
    });

    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    console.error('Failed to update student status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update student status'
    });
  }
});

/**
 * Quiz Management Endpoints
 */

// Create new quiz with validation
router.post('/quizzes', [
  check('title').trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
  check('description').optional().trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  check('questions').isArray({ min: 1 }).withMessage('At least one question is required'),
  check('questions.*.questionText').notEmpty().withMessage('Question text is required'),
  check('questions.*.options').isArray({ min: 2 }).withMessage('At least two options are required'),
  check('questions.*.correctAnswer').isInt({ min: 0 }).withMessage('Invalid correct answer index')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const quiz = new Quiz({
      ...req.body,
      createdBy: req.user._id
    });

    await quiz.save();

    // Log quiz creation
    await ActivityLog.create({
      action: 'quiz_created',
      description: `${req.user.firstName} ${req.user.lastName} created quiz "${quiz.title}"`,
      performedBy: req.user._id,
      targetQuiz: quiz._id
    });

    res.status(201).json({
      success: true,
      data: quiz
    });
  } catch (error) {
    console.error('Failed to create quiz:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create quiz'
    });
  }
});

// Assign multiple quizzes to a student
router.post('/students/:id/quizzes', [
  check('id').isMongoId().withMessage('Invalid student ID'),
  check('quizzes').isArray({ min: 1 }).withMessage('Quizzes must be an array with at least one quiz ID'),
  check('quizzes.*').isMongoId().withMessage('Invalid quiz ID in the quizzes array')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const quizzes = await Quiz.find({ _id: { $in: req.body.quizzes } });
    if (quizzes.length !== req.body.quizzes.length) {
      return res.status(404).json({
        success: false,
        error: 'One or more quizzes not found'
      });
    }

    // Add quizzes to the student's allowed quizzes
    const newQuizzes = quizzes.filter(quiz => !student.quizzesAllowed.includes(quiz._id));
    student.quizzesAllowed.push(...newQuizzes.map(quiz => quiz._id));
    await student.save();

    // Log the assignment for each quiz
    const activityLogs = newQuizzes.map(quiz => ({
      action: 'quiz_assigned',
      description: `${req.user.firstName} ${req.user.lastName} assigned quiz "${quiz.title}" to ${student.firstName} ${student.lastName}`,
      performedBy: req.user._id,
      targetUser: student._id,
      targetQuiz: quiz._id
    }));
    await ActivityLog.insertMany(activityLogs);

    res.json({
      success: true,
      message: 'Quizzes assigned successfully',
      data: student
    });
  } catch (error) {
    console.error('Failed to assign quizzes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign quizzes'
    });
  }
});

/**
 * Student Management Endpoints
 */

// Get all students with pagination and search
router.get('/students', [
  check('page').optional().isInt({ min: 1 }).toInt(),
  check('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  check('search').optional().trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    const filter = { role: 'student' };
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [students, count] = await Promise.all([
      User.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .select('firstName lastName email phone status quizzesAllowed createdAt'),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: students,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students'
    });
  }
});

//Get total number of students
router.get('/students/count', async (_req, res) => {
  try {
    const count = await User.countDocuments({ role: 'student' });
    res.json({
      success: true,
      data: { total: count }
    });
  } catch (error) {
    console.error('Failed to fetch student count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student count'
    });
  }
});


// Get a single student by ID
router.get('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await User.findById(id).select('firstName lastName email phone status quizzesAllowed createdAt');
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(200).json({ message: 'Student fetched successfully', student });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a student
router.put("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating password directly
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    }

    const student = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!student || student.role !== "student") {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ message: "Student updated successfully", student });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a student
router.delete("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findByIdAndDelete(id);
    if (!student || student.role !== "student") {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({ message: "Server error" });
  }
});



//Get all administartors with pagination and search
router.get('/administrators', [
  check('page').optional().isInt({ min: 1 }).toInt(),
  check('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  check('search').optional().trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    const filter = { role: 'admin' };
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [admins, count] = await Promise.all([
      User.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec(),
      User.countDocuments(filter)
      ]);
      res.json({
        success: true,
        data: admins,
        count: count
      });
  } catch (error) {
    console.error('Failed to fetch administrators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch administrators'
      });
      }
    });
/**
 * Activity Log Endpoints
 */

// Get recent activities
router.get('/activities', [
  check('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const limit = req.query.limit || 10;
    const activities = await ActivityLog.find()
      .sort('-createdAt')
      .limit(limit)
      .populate('performedBy', 'firstName lastName')
      .populate('targetUser', 'firstName lastName')
      .populate('targetQuiz', 'title');

    res.json({
      success: true,
      data: activities.map(activity => ({
        id: activity._id,
        type: activity.action,
        message: activity.description,
        timestamp: activity.createdAt,
        user: activity.performedBy,
        target: activity.targetUser || activity.targetQuiz
      }))
    });
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities'
    });
  }
});

// Helper function to calculate weekly trend
// async function getWeeklyTrend(model, filter) {
//   const oneWeekAgo = new Date();
//   oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

//   const [currentCount, previousCount] = await Promise.all([
//     model.countDocuments(filter),
//     model.countDocuments({
//       ...filter,
//       createdAt: { $lt: oneWeekAgo }
//     })
//   ]);

//   if (previousCount === 0) return 0;
//   return Math.round(((currentCount - previousCount) / previousCount) * 100);
// }

module.exports = router;