const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Quiz = require('../models/Quiz');
const Submission = require('../models/Submission');
const { check, validationResult } = require('express-validator');

// Get all quizzes with pagination, search, and attempts
router.get('/', auth, async (req, res) => {
  try {
    // Admin gets all quizzes, students only get allowed quizzes
    const filter = req.user.role === 'admin' 
      ? {}
      : { _id: { $in: req.user.quizzesAllowed }, isActive: true };

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Search
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Fetch quizzes
    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .sort('order')
        .skip(skip)
        .limit(limit)
        .select('title description questions order createdAt'), // Include necessary fields
      Quiz.countDocuments(filter)
    ]);

    // Fetch total attempts for each quiz
    const attempts = await Submission.aggregate([
      { $group: { _id: "$quiz", totalAttempts: { $sum: 1 } } },
    ]);

    // Map attempts to quizzes
    const attemptsMap = attempts.reduce((map, attempt) => {
      map[attempt._id] = attempt.totalAttempts;
      return map;
    }, {});

    // Add attempts to quizzes
    const quizzesWithAttempts = quizzes.map((quiz) => ({
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      totalQuestions: quiz.questions.length,
      order: quiz.order,
      createdAt: quiz.createdAt,
      attempts: attemptsMap[quiz._id] || 0, // Default to 0 if no attempts
    }));

    res.json({
      success: true,
      data: quizzesWithAttempts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching quizzes'
    });
  }
});

//Get total quizzes count
router.get('/count', auth, async (req, res) => {
try {
    const total = await Quiz.countDocuments({});
    res.json({
      success: true,
      total
    });
  } catch (error) {
    console.error('Error fetching total quizzes count:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching total quizzes count'
    });
  }
});


// Get quiz by ID with proper access control
router.get('/:id', [
  auth,
  check('id').isMongoId().withMessage('Invalid quiz ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ 
        success: false,
        error: 'Quiz not found' 
      });
    }

    // Check access
    const hasAccess = req.user.role === 'admin' || 
      (req.user.quizzesAllowed.includes(quiz._id) && quiz.isActive);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        success: false,
        error: 'Access to this quiz is restricted' 
      });
    }

    // For students, hide correct answers
    if (req.user.role === 'student') {
      const quizObj = quiz.toObject();
      quizObj.questions.forEach(q => delete q.correctAnswer);
      return res.json({ success: true, data: quizObj });
    }

    res.json({ success: true, data: quiz });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching quiz' 
    });
  }
});

// Submit quiz with validation
router.post('/:id/submit', [
  auth,
  check('id').isMongoId().withMessage('Invalid quiz ID'),
  check('answers').isArray().withMessage('Answers must be an array'),
  check('timeStarted').notEmpty().withMessage('Start time is required'),
  check('timeCompleted').notEmpty().withMessage('Completion time is required'),
  check('attemptNumber').isInt({ min: 1 }).withMessage('Attempt number is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ 
        success: false,
        error: 'Quiz not found' 
      });
    }

    const { answers, timeStarted, timeCompleted, attemptNumber } = req.body;

    // Validate answers
    if (answers.length !== quiz.questions.length) {
      return res.status(400).json({ 
        success: false,
        error: `Expected ${quiz.questions.length} answers, got ${answers.length}` 
      });
    }

    // Calculate score and answer details
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
      duration: Math.floor((new Date(timeCompleted) - new Date(timeStarted)) / 1000), // Duration in seconds
    });

    await submission.save();

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
        timeSpent: submission.duration,
        passingScore: quiz.passingScore,
      },
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to submit quiz' 
    });
  }
});

router.get('/submissions/:id', auth, async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id)
            .populate('quiz', 'title subject questions') // Populate quiz details
            .lean();

        if (!submission) {
            return res.status(404).json({
                success: false,
                error: 'Submission not found',
            });
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
        res.status(500).json({
            success: false,
            error: 'Server error while fetching submission details',
        });
    }
});



//Get total individual quiz attempts
router.get('/:id/attempts', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ 
        success: false,
        error: 'Quiz not found' 
      });
    }

    // Check access
    const hasAccess = req.user.role === 'admin' || 
      (req.user.quizzesAllowed.includes(quiz._id) && quiz.isActive);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        success: false,
        error: 'Access to this quiz is restricted' 
      });
    }

    const attempts = await Submission.countDocuments({ quiz: quiz._id });
    res.json({
      success: true,
      data: attempts
    });
  } catch (error) {
    console.error('Error fetching quiz attempts:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching quiz attempts'
    });
  }
});


// Get total attempts made by all students
router.get('/attempts', auth, async (req, res) => {
  try {
    const attempts = await Submission.aggregate([
      { $group: { _id: null, totalAttempts: { $sum: 1 } } },
    ]);
    
    res.json({
      success: true,
      data: attempts[0] ? attempts[0].totalAttempts : 0
    });
  } catch (error) {
    console.error('Error fetching total attempts:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching total attempts'
    });
  }
});

//Get total submissions count
router.get('/submissions/count', auth, async (req, res) => {
  try {
    const count = await Submission.countDocuments();
    res.json({
      success: true,
      data: count
    });
  } catch (error) {
    console.error('Error fetching submissions count:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching submissions count'
    });
  }
});

module.exports = router;