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
 * Dashboard Statistics Endpoints
 */

// Get student statistics with trends
router.get('/stats/students', async (req, res) => {
  try {
    const [activeCount, pendingCount, weeklyTrend] = await Promise.all([
      User.countDocuments({ role: 'student', status: 'active' }),
      User.countDocuments({ role: 'student', status: 'pending' }),
      getWeeklyTrend(User, { role: 'student', status: 'active' })
    ]);

    res.json({
      success: true,
      data: {
        active: activeCount,
        pending: pendingCount,
        trend: weeklyTrend
      }
    });
  } catch (error) {
    console.error('Failed to fetch student stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student statistics'
    });
  }
});

// Get quiz statistics
router.get('/stats/quizzes', async (req, res) => {
  try {
    const [activeCount, inactiveCount, popularQuiz] = await Promise.all([
      Quiz.countDocuments({ isActive: true }),
      Quiz.countDocuments({ isActive: false }),
      Quiz.getMostPopular()
    ]);

    res.json({
      success: true,
      data: {
        active: activeCount,
        inactive: inactiveCount,
        popular: popularQuiz
      }
    });
  } catch (error) {
    console.error('Failed to fetch quiz stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quiz statistics'
    });
  }
});

// Get submission statistics
router.get('/stats/submissions', async (req, res) => {
  try {
    const [totalSubmissions, avgScore, recentSubmissions] = await Promise.all([
      Submission.countDocuments(),
      Submission.getAverageScore(),
      Submission.find().sort('-submittedAt').limit(5)
    ]);

    res.json({
      success: true,
      data: {
        total: totalSubmissions,
        avgScore: avgScore,
        recent: recentSubmissions
      }
    });
  } catch (error) {
    console.error('Failed to fetch submission stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch submission statistics'
    });
  }
});

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
  check('status').isIn(['active', 'rejected']).withMessage('Invalid status'),
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

// Assign quiz to student
router.post('/students/:id/quizzes', [
  check('id').isMongoId().withMessage('Invalid student ID'),
  check('quizId').isMongoId().withMessage('Invalid quiz ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [student, quiz] = await Promise.all([
      User.findOne({ _id: req.params.id, role: 'student' }),
      Quiz.findById(req.body.quizId)
    ]);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    if (!student.quizzesAllowed.includes(quiz._id)) {
      student.quizzesAllowed.push(quiz._id);
      await student.save();

      // Log assignment
      await ActivityLog.create({
        action: 'quiz_assigned',
        description: `${req.user.firstName} ${req.user.lastName} assigned quiz "${quiz.title}" to ${student.firstName} ${student.lastName}`,
        performedBy: req.user._id,
        targetUser: student._id,
        targetQuiz: quiz._id
      });
    }

    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    console.error('Failed to assign quiz:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign quiz'
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
async function getWeeklyTrend(model, filter) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [currentCount, previousCount] = await Promise.all([
    model.countDocuments(filter),
    model.countDocuments({
      ...filter,
      createdAt: { $lt: oneWeekAgo }
    })
  ]);

  if (previousCount === 0) return 0;
  return Math.round(((currentCount - previousCount) / previousCount) * 100);
}

module.exports = router;