const mongoose = require('mongoose');

const QuizSessionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: [Number],
  flaggedQuestions: [Boolean],
  currentQuestionIndex: Number,
  timeLeft: Number,
  quizStartTime: String,
  updatedAt: { type: Date, default: Date.now }
});

QuizSessionSchema.index({ student: 1, quiz: 1 }, { unique: true });
module.exports = mongoose.model('QuizSession', QuizSessionSchema);