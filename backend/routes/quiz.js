const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Quiz = require('../models/Quiz');
const Submission = require('../models/Submission');
const { check, validationResult } = require('express-validator');

// Get all quizzes with pagination and search
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

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .sort('order')
        .skip(skip)
        .limit(limit)
        .select('-questions.correctAnswer'), // Hide correct answers
      Quiz.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: quizzes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
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
    const filter = req.user.role === 'admin'
      ? {}
      : { _id: { $in: req.user.quizzesAllowed }, isActive: true };
      const total = await Quiz.countDocuments(filter);
    res.json({
      success: true,
      data: total
    });
  } catch (error) {
    console.error('Error fetching quizzes count:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching quizzes count'
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
  check('answers').isArray().withMessage('Answers must be an array')
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

    // Check if already submitted
    const existingSubmission = await Submission.findOne({
      student: req.user._id,
      quiz: quiz._id
    });
    
    if (existingSubmission) {
      return res.status(400).json({ 
        success: false,
        error: 'Quiz already submitted' 
      });
    }

    // Validate answers
    const { answers } = req.body;
    if (answers.length !== quiz.questions.length) {
      return res.status(400).json({ 
        success: false,
        error: `Expected ${quiz.questions.length} answers, got ${answers.length}` 
      });
    }

    // Calculate score
    let score = 0;
    const answerDetails = quiz.questions.map((question, index) => {
      const selectedOption = answers[index];
      const isCorrect = selectedOption === question.correctAnswer;
      if (isCorrect) score += question.points;
      
      return {
        questionId: question._id,
        questionText: question.questionText,
        selectedOption,
        correctAnswer: question.correctAnswer,
        isCorrect,
        points: isCorrect ? question.points : 0
      };
    });

    const totalPossible = quiz.questions.reduce((sum, q) => sum + q.points, 0);
    const percentage = Math.round((score / totalPossible) * 100);

    const submission = new Submission({
      student: req.user._id,
      quiz: quiz._id,
      answers: answerDetails,
      score,
      totalPossible,
      percentage,
      passed: percentage >= quiz.passingScore || 70 // Default passing is 70%
    });

    await submission.save();
    
    res.status(201).json({ 
      success: true,
      data: {
        submissionId: submission._id,
        score,
        totalPossible,
        percentage,
        passed: submission.passed
      }
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while submitting quiz' 
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