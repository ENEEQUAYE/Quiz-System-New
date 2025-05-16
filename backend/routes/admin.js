const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const fs = require("fs");
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/role');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Submission = require('../models/Submission');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const Message = require('../models/Message');

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

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

    // Log approval activity and send notification
    await ActivityLog.logWithNotification({
      action: 'student_approval',
      description: `${req.user.firstName} ${req.user.lastName} ${req.body.status === 'active' ? 'approved' : 'rejected'} student, ${student.firstName} ${student.lastName}`,
      performedBy: req.user._id,
      targetUser: student._id,
      notificationTitle: req.body.status === 'active' ? 'Account Approved' : 'Account Rejected',
      notificationMessage: req.body.status === 'active'
        ? 'Your account has been approved. You can now access the system.'
        : 'Your account registration was rejected. Please contact support for more information.'
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
  check('timeLimit').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
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

    // Log quiz creation and send notification to all admins (optional)
    await ActivityLog.logWithNotification({
      action: 'quiz_created',
      description: `${req.user.firstName} ${req.user.lastName} created quiz "${quiz.title}"`,
      performedBy: req.user._id,
      targetQuiz: quiz._id,
      // notificationTitle and notificationMessage can be set if you want to notify someone
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

// Route to upload and parse quiz document
router.post("/quizzes/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    let text = "";

    // Parse the file based on its type
    if (file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const docxData = await mammoth.extractRawText({ path: file.path });
      text = docxData.value;
    } else if (file.mimetype === "text/plain") {
      text = fs.readFileSync(file.path, "utf-8");
    } else {
      return res.status(400).json({ success: false, error: "Unsupported file type" });
    }

    // Extract questions from the text
    const questions = extractQuestionsFromText(text);

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    res.json({ success: true, questions });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ success: false, error: "Failed to process file" });
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
  check('timeLimit').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
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
    await ActivityLog.logWithNotification({
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
    await ActivityLog.logWithNotification({
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
      { $addToSet: { allowedStudents: student._id } }
    );

    // Log the assignment for each quiz and send notification
    for (const quiz of newQuizzes) {
      await ActivityLog.logWithNotification({
        action: 'quiz_assigned',
        description: `${req.user.firstName} ${req.user.lastName} assigned quiz "${quiz.title}" to ${student.firstName} ${student.lastName}`,
        performedBy: req.user._id,
        targetUser: student._id,
        targetQuiz: quiz._id,
        notificationTitle: 'New Quiz Assigned',
        notificationMessage: `You have been assigned the quiz "${quiz.title}".`
      });
    }

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


// Assign quiz to all students
router.post('/quizzes/:quizId/assign-all', async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    // Find all active students
    const students = await User.find({ role: 'student', status: 'active' }).select('_id firstName lastName');
    const studentIds = students.map(s => s._id);

    // Update the quiz's allowedStudents
    await Quiz.updateOne(
      { _id: quizId },
      { $addToSet: { allowedStudents: { $each: studentIds } } }
    );

    // Update each student's quizzesAllowed
    await User.updateMany(
      { _id: { $in: studentIds } },
      { $addToSet: { quizzesAllowed: quiz._id } }
    );

    // Send notification to all students (avoid duplicates)
    for (const studentId of studentIds) {
      const existingNotification = await Notification.findOne({
        user: studentId,
        title: 'New Quiz Assigned',
        message: `You have been assigned the quiz "${quiz.title}".`
      });
      if (!existingNotification) {
        await Notification.create({
          user: studentId,
          title: 'New Quiz Assigned',
          message: `You have been assigned the quiz "${quiz.title}".`,
          createdAt: new Date(),
          isRead: false
        });
      }
    }

    // Log the assignment for each student (avoid duplicate activity)
    for (const student of students) {
      const existingActivity = await ActivityLog.findOne({
        action: 'quiz_assigned',
        performedBy: req.user._id,
        targetUser: student._id,
        targetQuiz: quiz._id
      });
      if (!existingActivity) {
        await ActivityLog.logWithNotification({
          action: 'quiz_assigned',
          description: `${req.user.firstName} ${req.user.lastName} assigned quiz "${quiz.title}" to ${student.firstName} ${student.lastName}`,
          performedBy: req.user._id,
          targetUser: student._id,
          targetQuiz: quiz._id,
          notificationTitle: 'New Quiz Assigned',
          notificationMessage: `You have been assigned the quiz "${quiz.title}".`
        });
      }
    }

    res.json({ success: true, message: 'Quiz assigned to all students successfully' });
  } catch (error) {
    console.error('Failed to assign quiz to all students:', error);
    res.status(500).json({ success: false, error: 'Failed to assign quiz to all students' });
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
        const submissions = await Submission.find({ student: student._id })
          .populate('quiz', 'title')
          .lean();

        // Group submissions by quiz ID and calculate the highest score for each quiz
        const quizScores = {};
        submissions.forEach(submission => {
          const quizId = submission.quiz._id.toString();
          if (!quizScores[quizId] || submission.percentage > quizScores[quizId].percentage) {
            quizScores[quizId] = {
              quizTitle: submission.quiz.title,
              percentage: submission.percentage
            };
          }
        });

        // Calculate total quizzes taken, total score, and average score
        const uniqueQuizzes = Object.values(quizScores);
        const totalQuizzesTaken = uniqueQuizzes.length;
        const totalScore = uniqueQuizzes.reduce((sum, quiz) => sum + quiz.percentage, 0);
        const averageScore = totalQuizzesTaken > 0 ? totalScore / totalQuizzesTaken : 0;

        // Format total score and average score
        const formattedTotalScore = Math.round(totalScore); // Always a whole number
        const formattedAverageScore = Number.isInteger(averageScore)
          ? averageScore // Display as a whole number if no decimals
          : averageScore.toFixed(2); // Otherwise, fix to 2 decimal places

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
          totalScore: formattedTotalScore,
          averageScore: formattedAverageScore,
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

    // Fetch student details
    const student = await User.findById(studentId).select('firstName lastName email').lean();
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Fetch submissions for the student
    const submissions = await Submission.find({ student: student._id })
      .populate('quiz', 'title')
      .lean();

    // Group submissions by quiz ID and calculate the highest score for each quiz
    const quizScores = {};
    submissions.forEach(submission => {
      const quizId = submission.quiz._id.toString();
      if (!quizScores[quizId] || submission.percentage > quizScores[quizId].percentage) {
        quizScores[quizId] = {
          quizTitle: submission.quiz.title,
          percentage: submission.percentage,
          timeCompleted: submission.timeCompleted
        };
      }
    });

    // Calculate total quizzes taken, total score, and average score
    const uniqueQuizzes = Object.values(quizScores);
    const totalQuizzesTaken = uniqueQuizzes.length;
    const totalScore = uniqueQuizzes.reduce((sum, quiz) => sum + quiz.percentage, 0);
    const averageScore = totalQuizzesTaken > 0 ? (totalScore / totalQuizzesTaken).toFixed(2) : 0;

    // Determine grade based on average score
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

    // Prepare the report
    const report = uniqueQuizzes.map((quiz, index) => ({
      quizTitle: quiz.quizTitle,
      percentage: quiz.percentage,
      timeCompleted: quiz.timeCompleted
    }));

    // Respond with the student report
    res.json({
      success: true,
      student,
      totalQuizzesTaken,
      totalScore: totalScore.toFixed(2),
      averageScore,
      grade,
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

// Get Notifications
router.get("/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, notifications: notifications.map(n => n.formatForClient()) });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
});

// Get Notification Count
router.get("/notifications/count", async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch notification count" });
  }
});

// Mark notifications as read
router.post("/notifications/mark-read", async (req, res) => {
  try {
    const { notificationIds } = req.body;
    await Notification.markAsRead(req.user._id, notificationIds);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to mark notifications as read" });
  }
});

/**
 * @desc    Get messages for the logged-in admin
 * @route   GET /admin/messages
 * @access  Private (Admin)
 */
router.get("/messages", async (req, res) => {
  try {
    const { page = 1, search = "", folder = "inbox" } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const filter = { recipient: req.user._id, folder };
    if (search) {
      filter.subject = { $regex: search, $options: "i" };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("subject body senderName isRead createdAt");

    const totalMessages = await Message.countDocuments(filter);

    res.json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page, 10),
        totalPages: Math.ceil(totalMessages / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

/**
 * @desc    Send a message
 * @route   POST /admin/messages
 * @access  Private (Admin)
 */
router.post(
  "/messages",
  [
    check("recipients").isArray().withMessage("Recipients must be an array"),
    check("subject").notEmpty().withMessage("Subject is required"),
    check("body").notEmpty().withMessage("Message body is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { recipients, subject, body } = req.body;

      const messages = recipients.map((recipientId) => ({
        sender: req.user._id,
        recipient: recipientId,
        subject,
        body,
        senderName: `${req.user.firstName} ${req.user.lastName}`,
      }));

      await Message.insertMany(messages);

      res.json({ success: true, message: "Message sent successfully" });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ success: false, error: "Failed to send message" });
    }
  }
);

/**
 * @desc    Delete messages
 * @route   DELETE /admin/messages
 * @access  Private (Admin)
 */
router.delete("/messages", async (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ success: false, error: "No message IDs provided" });
    }

    await Message.deleteMany({ _id: { $in: messageIds }, recipient: req.user._id });

    res.json({ success: true, message: "Messages deleted successfully" });
  } catch (error) {
    console.error("Error deleting messages:", error);
    res.status(500).json({ success: false, error: "Failed to delete messages" });
  }
});

/**
 * @desc    Get a specific message
 * @route   GET /admin/messages/:id
 * @access  Private (Admin)
 */
router.get("/messages/:id", async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      recipient: req.user._id,
    }).select("subject body senderName recipients createdAt isRead");

    if (!message) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }

    res.json({ success: true, message });
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({ success: false, error: "Failed to fetch message" });
  }
});

/**
 * @desc    Mark a message as read
 * @route   PATCH /admin/messages/:id/read
 * @access  Private (Admin)
 */
router.patch("/messages/:id/read", async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }

    res.json({ success: true, message: "Message marked as read" });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ success: false, error: "Failed to mark message as read" });
  }
});

/**
 * @desc    Get recipients for admin messages
 * @route   GET /admin/recipients
 * @access  Private (Admin)
 */
router.get("/recipients", async (req, res) => {
  try {
    // Fetch all students and admins as potential recipients
    const students = await User.find({ role: "student" }).select("firstName lastName email");
    const admins = await User.find({ role: "admin", _id: { $ne: req.user._id } }).select("firstName lastName email");

    const recipients = [
      ...students.map((student) => ({
        _id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        role: "Student",
      })),
      ...admins.map((admin) => ({
        _id: admin._id,
        name: `${admin.firstName} ${admin.lastName}`,
        email: admin.email,
        role: "Admin",
      })),
    ];

    res.json({ success: true, recipients });
  } catch (error) {
    console.error("Error fetching recipients:", error);
    res.status(500).json({ success: false, error: "Failed to fetch recipients" });
  }
});

// Function to extract questions from text
function extractQuestionsFromText(text) {
    const questions = [];
    const questionRegex = /\d+\.\s+(.+?)\n\s*[A|a]\.\s+(.+?)\n\s*[B|b]\.\s+(.+?)\n\s*[C|c]\.\s+(.+?)\n\s*[D|d]\.\s+(.+?)(?=\n\d+\.|\n*$)/gs;

    let match;
    while ((match = questionRegex.exec(text)) !== null) {
        questions.push({
            questionText: match[1].trim(), // Extracted question text
            options: [
                match[2].trim(), // Option A
                match[3].trim(), // Option B
                match[4].trim(), // Option C
                match[5].trim()  // Option D
            ],
        });
    }
    return questions;
}

module.exports = router;



