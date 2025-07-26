const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Quiz = require('../models/Quiz');
const Submission = require('../models/Submission');
const { check, validationResult } = require('express-validator');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const QuizSession = require('../models/QuizSession');

// Helper function for common error responses
const errorResponse = (res, status, message) => {
  return res.status(status).json({ 
    success: false,
    error: message 
  });
};

// Validate quiz access
const validateQuizAccess = async (quizId, user) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) return { error: 'Quiz not found' };

    const hasAccess = user.role === 'admin' ||
    (user.quizzesAllowed.includes(quiz._id) && quiz.isActive);
  
  if (!hasAccess) return { error: 'Access to this quiz is restricted' };

  return { quiz };
};


// Get all quizzes with pagination, search, and attempts
router.get('/', auth, async (req, res) => {
  try {
    const { role, quizzesAllowed } = req.user;
    const { page = 1, limit = 10, search } = req.query;

    // Build filter
    const filter = role === 'admin' 
      ? {} 
      : { 
          _id: { $in: quizzesAllowed }, 
          isActive: true 
        };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute queries in parallel
    const [quizzes, total, attempts] = await Promise.all([
      Quiz.find(filter)
        .sort('order')
        .skip((page - 1) * limit)
        .limit(limit)
        .select('title description questions order createdAt'),
      Quiz.countDocuments(filter),
      Submission.aggregate([
        { $group: { _id: "$quiz", totalAttempts: { $sum: 1 } } }
      ])
    ]);

    // Create attempts map
    const attemptsMap = attempts.reduce((map, { _id, totalAttempts }) => ({
      ...map,
      [_id]: totalAttempts
    }), {});

    // Format response
    const data = quizzes.map(quiz => ({
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      totalQuestions: quiz.questions.length,
      order: quiz.order,
      createdAt: quiz.createdAt,
      attempts: attemptsMap[quiz._id] || 0
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching quizzes:', error);
    errorResponse(res, 500, 'Server error while fetching quizzes');
  }
});

// Get quiz by ID with access control
router.get('/:id', [
  auth,
  check('id').isMongoId().withMessage('Invalid quiz ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { quiz, error } = await validateQuizAccess(req.params.id, req.user);
    if (error) return errorResponse(res, error.includes('not found') ? 404 : 403, error);

    // For students, hide correct answers
    if (req.user.role === 'student') {
      const quizObj = quiz.toObject();
      quizObj.questions.forEach(q => delete q.correctAnswer);
      return res.json({ success: true, data: quizObj });
    }

    res.json({ success: true, data: quiz });

  } catch (error) {
    console.error('Error fetching quiz:', error);
    errorResponse(res, 500, 'Server error while fetching quiz');
  }
});

// Quiz session management
router.route('/:id/session')
  .all(
    auth,
    check('id').isMongoId().withMessage('Invalid quiz ID'),
    async (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      if (req.user.role !== 'student') return errorResponse(res, 403, 'Only students can manage quiz sessions');
      next();
    }
  )
  // Save session
  .post(async (req, res) => {
    try {
      const { quiz, error } = await validateQuizAccess(req.params.id, req.user);
      if (error) return errorResponse(res, error.includes('not found') ? 404 : 403, error);

      const { answers, flaggedQuestions, currentQuestionIndex, timeLeft, quizStartTime } = req.body;

      await QuizSession.findOneAndUpdate(
        { student: req.user._id, quiz: quiz._id },
        { 
          answers, 
          flaggedQuestions, 
          currentQuestionIndex, 
          timeLeft, 
          quizStartTime, 
          updatedAt: new Date() 
        },
        { upsert: true, new: true }
      );

      res.json({ success: true, message: 'Session saved' });

    } catch (error) {
      console.error('Error saving session:', error);
      errorResponse(res, 500, 'Server error while saving session');
    }
  })
  // Get session
  .get(async (req, res) => {
    try {
      const { quiz, error } = await validateQuizAccess(req.params.id, req.user);
      if (error) return errorResponse(res, error.includes('not found') ? 404 : 403, error);

      const session = await QuizSession.findOne({ 
        student: req.user._id, 
        quiz: quiz._id 
      }).lean();

      res.json({ success: true, session });

    } catch (error) {
      console.error('Error loading session:', error);
      errorResponse(res, 500, 'Server error while loading session');
    }
  })
  // Delete session
  .delete(async (req, res) => {
    try {
      await QuizSession.deleteOne({
        student: req.user._id,
        quiz: req.params.id
      });
      res.json({ success: true, message: 'Session cleared' });
    } catch (error) {
      console.error('Error clearing session:', error);
      errorResponse(res, 500, 'Failed to clear session');
    }
  });

// Auto-submit quiz when time expires
router.post('/:id/auto-submit', [
  auth,
  check('id').isMongoId().withMessage('Invalid quiz ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { quiz, error } = await validateQuizAccess(req.params.id, req.user);
    if (error) return errorResponse(res, error.includes('not found') ? 404 : 403, error);

    // Get the existing session
    const session = await QuizSession.findOne({ 
      student: req.user._id, 
      quiz: quiz._id 
    });

    if (!session) {
      return errorResponse(res, 404, 'No active session found');
    }

    // Use session data for submission
    const answers = session.answers || new Array(quiz.questions.length).fill(-1);
    const timeStarted = session.quizStartTime;
    const timeCompleted = new Date().toISOString();
    const attemptNumber = 1;

    // Calculate results
    let score = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unansweredQuestions = 0;

    const answerDetails = quiz.questions.map((question, index) => {
      const selectedOption = answers[index];
      const isCorrect = selectedOption === question.correctAnswer;

      if (selectedOption === -1 || selectedOption === null || selectedOption === undefined) {
        unansweredQuestions++;
      } else if (isCorrect) {
        correctAnswers++;
        score += question.points;
      } else {
        incorrectAnswers++;
      }

      return {
        questionId: question._id,
        questionText: question.questionText,
        selectedOption: selectedOption === null || selectedOption === undefined ? -1 : selectedOption,
        correctAnswer: question.correctAnswer,
        isCorrect,
        pointsEarned: isCorrect ? question.points : 0,
        pointsPossible: question.points,
      };
    });

    const totalQuestions = quiz.questions.length;
    const totalPossible = quiz.questions.reduce((sum, q) => sum + q.points, 0);
    const percentage = Math.round((score / totalPossible) * 100);
    const duration = Math.floor((new Date(timeCompleted) - new Date(timeStarted)) / 1000);

    // Create submission
    const submission = new Submission({
      student: req.user._id,
      quiz: quiz._id,
      attemptNumber,
      answers: answerDetails,
      score,
      totalPossible,
      percentage,
      passed: percentage >= quiz.passingScore,
      timeStarted,
      timeCompleted,
      duration,
    });

    await submission.save();

    // Clear the session after submission
    await QuizSession.deleteOne({
      student: req.user._id,
      quiz: quiz._id
    });

    // Log activity and send notification
    await ActivityLog.logWithNotification({
      action: 'quiz_auto_submitted',
      description: `${req.user.firstName} ${req.user.lastName} auto-submitted quiz "${quiz.title}" due to time expiry`,
      performedBy: req.user._id,
      targetUser: req.user._id,
      targetQuiz: quiz._id,
      notificationTitle: 'Quiz Auto-Submitted',
      notificationMessage: `Your quiz "${quiz.title}" was automatically submitted due to time expiry.`
    });

    res.status(201).json({
      success: true,
      data: {
        submissionId: submission._id,
        score,
        totalPossible,
        percentage,
        passed: submission.passed,
        totalQuestions,
        correctAnswers,
        incorrectAnswers,
        unansweredQuestions,
        timeSpent: duration,
        passingScore: quiz.passingScore,
        autoSubmitted: true
      },
    });

  } catch (error) {
    console.error('Error auto-submitting quiz:', error);
    errorResponse(res, 500, 'Failed to auto-submit quiz');
  }
});

// Submit quiz with validation
router.post('/:id/submit', [
  auth,
  check('id').isMongoId().withMessage('Invalid quiz ID'),
  check('answers').isArray().withMessage('Answers must be an array'),
  check('timeStarted').isISO8601().withMessage('Valid start time is required'),
  check('timeCompleted').isISO8601().withMessage('Valid completion time is required'),
  check('attemptNumber').isInt({ min: 1 }).withMessage('Valid attempt number is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { quiz, error } = await validateQuizAccess(req.params.id, req.user);
    if (error) return errorResponse(res, error.includes('not found') ? 404 : 403, error);

    const { answers, timeStarted, timeCompleted, attemptNumber } = req.body;

    // Validate answers length
    if (answers.length !== quiz.questions.length) {
      return errorResponse(res, 400, 
        `Expected ${quiz.questions.length} answers, got ${answers.length}`
      );
    }

    // Calculate results
    let score = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unansweredQuestions = 0;

    const answerDetails = quiz.questions.map((question, index) => {
      const selectedOption = answers[index];
      const isCorrect = selectedOption === question.correctAnswer;

      if (selectedOption === -1) {
        unansweredQuestions++;
      } else if (isCorrect) {
        correctAnswers++;
        score += question.points;
      } else {
        incorrectAnswers++;
      }

      return {
        questionId: question._id,
        questionText: question.questionText,
        selectedOption,
        correctAnswer: question.correctAnswer,
        isCorrect,
        pointsEarned: isCorrect ? question.points : 0,
        pointsPossible: question.points,
      };
    });

    const totalQuestions = quiz.questions.length;
    const totalPossible = quiz.questions.reduce((sum, q) => sum + q.points, 0);
    const percentage = Math.round((score / totalPossible) * 100);
    const duration = Math.floor((new Date(timeCompleted) - new Date(timeStarted)) / 1000);

    // Create submission
    const submission = new Submission({
      student: req.user._id,
      quiz: quiz._id,
      attemptNumber,
      answers: answerDetails,
      score,
      totalPossible,
      percentage,
      passed: percentage >= quiz.passingScore,
      timeStarted,
      timeCompleted,
      duration,
    });

    await submission.save();

    // Clear the session after submission
    await QuizSession.deleteOne({
      student: req.user._id,
      quiz: quiz._id
    });

    // Log activity and send notification
    await ActivityLog.logWithNotification({
      action: 'quiz_attempted',
      description: `${req.user.firstName} ${req.user.lastName} attempted quiz "${quiz.title}"`,
      performedBy: req.user._id,
      targetUser: req.user._id,
      targetQuiz: quiz._id,
      notificationTitle: 'Quiz Attempted',
      notificationMessage: `You attempted the quiz "${quiz.title}".`
    });

    res.status(201).json({
      success: true,
      data: {
        submissionId: submission._id,
        score,
        totalPossible,
        percentage,
        passed: submission.passed,
        totalQuestions,
        correctAnswers,
        incorrectAnswers,
        unansweredQuestions,
        timeSpent: duration,
        passingScore: quiz.passingScore,
      },
    });

  } catch (error) {
    console.error('Error submitting quiz:', error);
    errorResponse(res, 500, 'Failed to submit quiz');
  }
});

// Get submission details
router.get('/submissions/:id', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('quiz', 'title subject questions')
      .lean();

    if (!submission) {
      return errorResponse(res, 404, 'Submission not found');
    }

    // Verify the requesting user owns this submission or is admin
    if (req.user.role !== 'admin' && !submission.student.equals(req.user._id)) {
      return errorResponse(res, 403, 'Access to this submission is restricted');
    }

    res.json({
      success: true,
      data: {
        quiz: submission.quiz,
        answers: submission.answers,
        score: submission.score,
        totalPossible: submission.totalPossible,
        percentage: submission.percentage,
        passed: submission.passed,
        timeStarted: submission.timeStarted,
        timeCompleted: submission.timeCompleted,
        duration: submission.duration,
      },
    });

  } catch (error) {
    console.error('Error fetching submission details:', error);
    errorResponse(res, 500, 'Server error while fetching submission details');
  }
});

// Get quiz attempts count
router.get('/:id/attempts', auth, async (req, res) => {
  try {
    const { quiz, error } = await validateQuizAccess(req.params.id, req.user);
    if (error) return errorResponse(res, error.includes('not found') ? 404 : 403, error);

    const attempts = await Submission.countDocuments({ quiz: quiz._id });
    res.json({ success: true, data: attempts });

  } catch (error) {
    console.error('Error fetching quiz attempts:', error);
    errorResponse(res, 500, 'Server error while fetching quiz attempts');
  }
});

// Get total attempts across all quizzes
router.get('/attempts/total', auth, async (req, res) => {
  try {
    const result = await Submission.aggregate([
      { $group: { _id: null, totalAttempts: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      data: result[0]?.totalAttempts || 0
    });

  } catch (error) {
    console.error('Error fetching total attempts:', error);
    errorResponse(res, 500, 'Server error while fetching total attempts');
  }
});

// Get total submissions count
router.get('/submissions/count', auth, async (req, res) => {
  try {
    const count = await Submission.countDocuments();
    res.json({ success: true, data: count });
  } catch (error) {
    console.error('Error fetching submissions count:', error);
    errorResponse(res, 500, 'Server error while fetching submissions count');
  }
});

module.exports = router;