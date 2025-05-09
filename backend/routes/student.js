const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const role = require("../middleware/role");
const Quiz = require("../models/Quiz");
const Submission = require("../models/Submission");
const User = require("../models/User");
const Message = require("../models/Message"); // Assuming you have a Message model
const { check, validationResult } = require("express-validator");
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');

// Apply authentication and role middleware
router.use(auth);
router.use(role("student"));

/**
 * @desc    Get dashboard stats
 * @route   GET /students/dashboard
 * @access  Private (Student)
 */
router.get("/dashboard", async (req, res) => {
  try {
    const studentId = req.user._id;

    // Fetch stats
    const availableQuizzes = await Quiz.countDocuments({ isActive: true });

    // Count unique quizzes completed by the student
    const completedQuizzes = await Submission.aggregate([
      { $match: { student: studentId } }, // Filter submissions by student
      { $group: { _id: "$quiz" } }, // Group by quiz ID
      { $count: "uniqueQuizzes" } // Count unique quizzes
    ]);

    const completedQuizzesCount = completedQuizzes[0]?.uniqueQuizzes || 0;

    // Calculate the average score
    const averageScore = await Submission.aggregate([
      { $match: { student: studentId } },
      { $group: { _id: null, avgScore: { $avg: "$percentage" } } },
    ]);

    // Format the average score to 2 decimal places
    const formattedAverageScore = averageScore[0]?.avgScore
      ? parseFloat(averageScore[0].avgScore.toFixed(2))
      : 0;

    // Fetch the next quiz
    const nextQuiz = await Quiz.findOne({ isActive: true })
      .sort({ startDate: 1 })
      .select("title startDate");

    res.json({
      success: true,
      availableQuizzes,
      completedQuizzes: completedQuizzesCount,
      averageScore: formattedAverageScore || 0,
      nextQuiz: nextQuiz ? nextQuiz.title : "None",
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch dashboard stats" });
  }
});



/**
 * @desc    Get assigned quizzes for a student
 * @route   GET /students/quizzes
 * @access  Private (Student)
 */
router.get("/quizzes", async (req, res) => {
  try {
    const { page = 1, search = "" } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Fetch the student's assigned quizzes
    const student = await User.findById(req.user._id).select("quizzesAllowed");
    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    const filter = { _id: { $in: student.quizzesAllowed } }; // Filter quizzes by assigned IDs
    if (search) {
      filter.title = { $regex: search, $options: "i" }; // Add search functionality
    }

    const quizzes = await Quiz.find(filter)
      .sort({ order: 1 })
      .skip(skip)
      .limit(limit)
      .select("title description questions timeLimit maxAttempts");

    // Fetch the number of attempts for each quiz by the student
    const attempts = await Submission.aggregate([
      { $match: { student: req.user._id } },
      { $group: { _id: "$quiz", attempts: { $sum: 1 } } },
    ]);

    // Map attempts to quizzes
    const attemptsMap = attempts.reduce((map, attempt) => {
      map[attempt._id] = attempt.attempts;
      return map;
    }, {});

    const quizzesWithDetails = quizzes.map((quiz) => ({
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      totalQuestions: quiz.questions.length, // Calculate total questions
      duration: quiz.timeLimit, // Use the correct field for duration
      maxAttempts: quiz.maxAttempts || "Unlimited", // Include maxAttempts
      attempts: attemptsMap[quiz._id] || 0, // Default to 0 if no attempts
    }));

    const total = await Quiz.countDocuments(filter);

    res.json({
      success: true,
      quizzes: quizzesWithDetails,
      pagination: {
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching assigned quizzes:", error);
    res.status(500).json({ success: false, error: "Failed to fetch assigned quizzes" });
  }
});


/**
 * @desc    Get gradebook
 * @route   GET /students/gradebook
 * @access  Private (Student)
 */
router.get("/gradebook", async (req, res) => {
  try {
    const studentId = req.user._id;

    // Use aggregation to group submissions by quiz and get the highest score
    const gradebook = await Submission.aggregate([
      { $match: { student: studentId } }, // Filter submissions by student
      {
        $group: {
          _id: "$quiz", // Group by quiz ID
          highestScore: { $max: "$score" }, // Get the highest score
          totalPossible: { $first: "$totalPossible" }, // Keep total possible score
          percentage: { $max: "$percentage" }, // Get the highest percentage
          passed: { $max: "$passed" }, // Check if the highest score passed
        },
      },
      {
        $lookup: {
          from: "quizzes", // Join with the Quiz collection
          localField: "_id",
          foreignField: "_id",
          as: "quizDetails",
        },
      },
      {
        $project: {
          _id: 0,
          quizId: "$_id",
          quizTitle: { $arrayElemAt: ["$quizDetails.title", 0] }, // Get the quiz title
          highestScore: 1,
          totalPossible: 1,
          percentage: 1,
          passed: 1,
          grade: {
            $switch: {
              branches: [
                { case: { $gte: ["$percentage", 90] }, then: "A" },
                { case: { $gte: ["$percentage", 80] }, then: "B" },
                { case: { $gte: ["$percentage", 70] }, then: "C" },
              ],
              default: "F",
            },
          },
        },
      },
    ]);

    res.json({ success: true, gradebook });
  } catch (error) {
    console.error("Error fetching gradebook:", error);
    res.status(500).json({ success: false, error: "Failed to fetch gradebook" });
  }
});

 
/**
 * @desc    Get profile
 * @route   GET /students/profile
 * @access  Private (Student)
 */
router.get("/profile", async (req, res) => {
  try {
    const student = await User.findById(req.user._id).select(
      "firstName lastName email phone profilePicture"
    );
    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    res.json({ success: true, profile: student });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ success: false, error: "Failed to fetch profile" });
  }
});

/**
 * @desc    Get messages
 * @route   GET /students/messages
 * @access  Private (Student)
 */
router.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .select("subject body senderName createdAt");

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

/**
 * @desc    Get notifications
 * @route   GET /students/notifications
 * @access  Private (Student)
 */
router.get("/notifications", async (req, res) => {
  try {
    const notifications = await Message.find({ recipient: req.user._id, type: "notification" })
      .sort({ createdAt: -1 }) // Sort by most recent
      .select("title message createdAt");

    res.json({ success: true, notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
});



/**
 * @desc    Get recent activities for the logged-in student
 * @route   GET /students/activities
 * @access  Private (Student)
 */
router.get("/activities", async (req, res) => {
  try {
    const activities = await ActivityLog.find({
      $or: [
        { targetUser: req.user._id },
        { performedBy: req.user._id }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("performedBy", "firstName lastName")
      .populate("targetQuiz", "title");

    res.json({
      success: true,
      data: activities.map(activity => {
        let message = "";
        // Personalize based on action type
        if (activity.action === "quiz_attempted" && String(activity.performedBy?._id) === String(req.user._id)) {
          message = `You attempted "${activity.targetQuiz?.title || 'a quiz'}"`;
        } else if (activity.action === "quiz_assigned" && String(activity.targetUser) === String(req.user._id)) {
          message = `You were assigned "${activity.targetQuiz?.title || 'a quiz'}"`;
        } else if (activity.action === "profile_updated" && String(activity.performedBy?._id) === String(req.user._id)) {
          message = `You updated your profile`;
        } else if (activity.action === "submission_graded" && String(activity.targetUser) === String(req.user._id)) {
          message = `Your submission for "${activity.targetQuiz?.title || 'a quiz'}" was graded`;
        } else {
          // Fallback to original description
          message = activity.description;
        }

        return {
          id: activity._id,
          type: activity.action,
          message,
          timestamp: activity.createdAt,
          user: activity.performedBy,
          quiz: activity.targetQuiz,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ success: false, error: "Failed to fetch activities" });
  }
});

// Get notifications
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

// Get notification count
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
 * @desc    Get a specific quiz
 * @route   GET /students/quizzes/:id
 * @access  Private (Student)
 */
router.get(
  "/quizzes/:id",
  [check("id").isMongoId().withMessage("Invalid quiz ID")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.user._id;
      const quizId = req.params.id;

      // Fetch the quiz
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        return res.status(404).json({ success: false, error: "Quiz not found" });
      }

      // Check the number of attempts made by the student
      const attempts = await Submission.countDocuments({ student: studentId, quiz: quizId });
      if (attempts >= quiz.maxAttempts) {
        return res.status(403).json({
          success: false,
          error: "You have reached the maximum number of attempts for this quiz",
        });
      }

      // Hide correct answers for students
      const quizData = quiz.toObject();
      quizData.questions.forEach((q) => delete q.correctAnswer);

      res.json({ success: true, quiz: quizData });
    } catch (error) {
      console.error("Error fetching quiz:", error);
      res.status(500).json({ success: false, error: "Failed to fetch quiz" });
    }
  }
);

//Get submission details
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

module.exports = router;