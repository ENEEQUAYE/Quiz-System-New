const mongoose = require('mongoose');
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
      description: `${req.user.firstName} ${req.user.lastName} ${req.body.status === 'active' ? 'approved' : 'rejected'} student, ${student.firstName} ${student.lastName}`,
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
  check('order').isInt({ min: 1 }).withMessage('Order must be a positive integer'),
  check('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  check('passingScore').isInt({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
  check('category').trim().notEmpty().withMessage('Category is required'),
  check('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
  check('maxAttempts').isInt({ min: 1 }).withMessage('Max attempts must be at least 1'),
  check('tags').isArray().withMessage('Tags must be an array'),
  check('tags.*').isString().withMessage('Each tag must be a string'),
  check('isActive').isBoolean().withMessage('isActive must be a boolean'),
  check('questions').isArray({ min: 1 }).withMessage('At least one question is required'),
  check('questions.*.questionText').notEmpty().withMessage('Question text is required'),
  check('questions.*.options').isArray({ min: 2 }).withMessage('At least two options are required'),
  check('questions.*.correctAnswer').isInt({ min: 0 }).withMessage('Invalid correct answer index'),
  check('questions.*.points').isInt({ min: 1 }).withMessage('Points must be at least 1')
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

// Update an existing quiz
router.put('/quizzes/:id', [
  check('id').isMongoId().withMessage('Invalid quiz ID'),
  check('title').optional().trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
  check('description').optional().trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  check('order').optional().isInt({ min: 1 }).withMessage('Order must be a positive integer'),
  check('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  check('passingScore').optional().isInt({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
  check('category').optional().trim().notEmpty().withMessage('Category is required'),
  check('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
  check('maxAttempts').optional().isInt({ min: 1 }).withMessage('Max attempts must be at least 1'),
  check('tags').optional().isArray().withMessage('Tags must be an array'),
  check('tags.*').optional().isString().withMessage('Each tag must be a string'),
  check('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  check('questions').optional().isArray({ min: 1 }).withMessage('At least one question is required'),
  check('questions.*.questionText').optional().notEmpty().withMessage('Question text is required'),
  check('questions.*.options').optional().isArray({ min: 2 }).withMessage('At least two options are required'),
  check('questions.*.correctAnswer').optional().isInt({ min: 0 }).withMessage('Invalid correct answer index'),
  check('questions.*.points').optional().isInt({ min: 1 }).withMessage('Points must be at least 1')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const updates = req.body;

    // Find the quiz by ID and update it
    const quiz = await Quiz.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    // Log the update activity
    await ActivityLog.create({
      action: 'quiz_updated',
      description: `${req.user.firstName} ${req.user.lastName} updated quiz "${quiz.title}"`,
      performedBy: req.user._id,
      targetQuiz: quiz._id
    });

    res.status(200).json({ success: true, message: 'Quiz updated successfully', data: quiz });
  } catch (error) {
    console.error('Failed to update quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to update quiz' });
  }
});

// Delete a quiz
router.delete('/quizzes/:id', [
  check('id').isMongoId().withMessage('Invalid quiz ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;

    // Find and delete the quiz
    const quiz = await Quiz.findByIdAndDelete(id);
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    // Log the deletion activity
    await ActivityLog.create({
      action: 'quiz_deleted',
      description: `${req.user.firstName} ${req.user.lastName} deleted quiz "${quiz.title}"`,
      performedBy: req.user._id,
      targetQuiz: quiz._id
    });

    res.status(200).json({ success: true, message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Failed to delete quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to delete quiz' });
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
    const studentId = req.params.id;
    const { quizzes } = req.body;

    // Find the student
    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Find the quizzes
    const quizzesToAssign = await Quiz.find({ _id: { $in: quizzes } });
    if (quizzesToAssign.length !== quizzes.length) {
      return res.status(404).json({
        success: false,
        error: 'One or more quizzes not found'
      });
    }

    // Add quizzes to the student's `quizzesAllowed` field
    const newQuizzes = quizzesToAssign.filter(quiz => !student.quizzesAllowed.includes(quiz._id));
    student.quizzesAllowed.push(...newQuizzes.map(quiz => quiz._id));
    await student.save();

    // Update the `allowedStudents` field in each quiz
    await Quiz.updateMany(
      { _id: { $in: quizzes } },
      { $addToSet: { allowedStudents: student._id } } // Add the student ID to `allowedStudents`
    );

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

// Get total number of students
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

// Get student reports with pagination and search
router.get('/students/report', [
  check('page').optional().isInt({ min: 1 }).toInt(),
  check('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  check('search').optional().trim().escape()
], async (req, res) => {
  try {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Pagination and search parameters
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    // Filter for students
    const filter = { role: 'student' };
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Fetch students and total count
    const [students, total] = await Promise.all([
      User.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .select('firstName lastName email quizzesAllowed')
        .lean(),
      User.countDocuments(filter)
    ]);

    // Generate reports for each student
    const studentReports = await Promise.all(students.map(async (student) => {
      try {
        const submissions = await Submission.find({ student: student._id }).lean();
        const totalQuizzesTaken = submissions.length;
        const totalScore = submissions.reduce((sum, sub) => sum + (sub.percentage || 0), 0);
        const averageScore = totalQuizzesTaken > 0 ? (totalScore / totalQuizzesTaken).toFixed(2) : 0;

        // Compute grade based on average score
        let grade;
        if (totalQuizzesTaken === 0) {
          grade = 'N/A'; // No quizzes taken
        } else if (averageScore >= 90) {
          grade = 'A';
        } else if (averageScore >= 80) {
          grade = 'B';
        } else if (averageScore >= 70) {
          grade = 'C';
        } else {
          grade = 'F'; // Below 70%
        }

        return {
          ...student,
          totalQuizzesTaken,
          totalScore: totalScore.toFixed(2),
          averageScore,
          grade
        };
      } catch (error) {
        console.error(`Error processing student ${student._id}:`, error);
        return {
          ...student,
          totalQuizzesTaken: 0,
          totalScore: 0,
          averageScore: 0,
          grade: 'N/A'
        };
      }
    }));

    // Respond with student reports
    res.json({
      success: true,
      data: studentReports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in /students/report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student reports',
      details: error.message
    });
  }
});

// Get a single student by ID
router.get('/students/:id', auth, async (req, res) => {
  try {
      const student = await User.findOne({ _id: req.params.id, role: 'student' });
      if (!student) {
          return res.status(404).json({ success: false, error: 'Student not found' });
      }
      res.json({ success: true, student });
  } catch (error) {
      console.error('Error fetching student:', error);
      res.status(500).json({ success: false, error: 'Server error' });
  }
});


// Update a student
router.put("/students/:id", [
  check('id').isMongoId().withMessage('Invalid student ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

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
router.delete("/students/:id", [
  check('id').isMongoId().withMessage('Invalid student ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

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



// Get detailed report for a single student
router.get('/students/:id/report', [
  check('id').isMongoId().withMessage('Invalid student ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const studentId = req.params.id;

    // Validate that the ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, error: 'Invalid student ID' });
    }

    const student = await User.findById(studentId).select('firstName lastName email').lean();
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const submissions = await Submission.find({ student: student._id })
      .populate('quiz', 'title')
      .lean();

    const report = submissions.map(submission => ({
      quizTitle: submission.quiz.title,
      score: submission.score,
      totalPossible: submission.totalPossible,
      percentage: submission.percentage,
      passed: submission.passed,
      attemptNumber: submission.attemptNumber,
      timeCompleted: submission.timeCompleted
    }));

    res.json({
      success: true,
      student,
      report
    });
  } catch (error) {
    console.error('Failed to fetch student report:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch student report' });
  }
});
/**
 * Administrator Management Endpoints
 */

// Get all administrators with pagination and search
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
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
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

module.exports = router;



