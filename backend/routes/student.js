const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const role = require("../middleware/role");
const Quiz = require("../models/Quiz");
const Submission = require("../models/Submission");
const User = require("../models/User");
const Message = require("../models/Message"); // Assuming you have a Message model
const { check, validationResult } = require("express-validator");

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
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .select("title questions timeLimit maxAttempts");

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

module.exports = router;