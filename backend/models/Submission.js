const mongoose = require('mongoose');
const validator = require('validator');

const AnswerSchema = new mongoose.Schema({
  questionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: [true, 'Question ID is required'],
    ref: 'Quiz.questions'
  },
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [500, 'Question text cannot exceed 500 characters']
  },
  selectedOption: { 
    type: Number, 
    required: [true, 'Selected option is required'],
    min: [-1, 'Selected option index cannot be less than -1 (use -1 for unanswered)']
  },
  correctAnswer: {
    type: Number,
    required: [true, 'Correct answer is required']
  },
  isCorrect: { 
    type: Boolean, 
    required: [true, 'Correctness flag is required'] 
  },
  pointsEarned: {
    type: Number,
    required: [true, 'Points earned is required'],
    min: [0, 'Points earned cannot be negative']
  },
  pointsPossible: {
    type: Number,
    required: [true, 'Points possible is required'],
    min: [1, 'Points possible must be at least 1']
  },
  timeSpent: {  // in seconds
    type: Number,
    min: [0, 'Time spent cannot be negative'],
  },
  questionType: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer'],
    default: 'multiple-choice'
  }
}, { _id: false });

const SubmissionSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Student ID is required'],
    index: true
  },
  quiz: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Quiz', 
    required: [true, 'Quiz ID is required'],
    index: true
  },
  attemptNumber: {
    type: Number,
    required: [true, 'Attempt number is required'],
    min: [1, 'Attempt number must be at least 1']
  },
  answers: {
    type: [AnswerSchema],
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: 'Submission must have at least one answer'
    }
  },
  score: { 
    type: Number, 
    required: [true, 'Score is required'],
    min: [0, 'Score cannot be negative']
  },
  totalPossible: { 
    type: Number, 
    required: [true, 'Total possible score is required'],
    min: [1, 'Total possible must be at least 1']
  },
  percentage: { 
    type: Number, 
    required: [true, 'Percentage is required'],
    min: [0, 'Percentage cannot be negative'],
    max: [100, 'Percentage cannot exceed 100']
  },
  passed: {
    type: Boolean,
    required: [true, 'Passed status is required']
  },
  timeStarted: {
    type: Date,
    required: [true, 'Start time is required'],
    validate: {
      validator: function(v) {
        return v <= new Date();
      },
      message: 'Start time cannot be in the future'
    }
  },
  timeCompleted: {
    type: Date,
    required: [true, 'Completion time is required'],
    validate: {
      validator: function(v) {
        return v >= this.timeStarted && v <= new Date();
      },
      message: 'Completion time must be after start time and not in the future'
    }
  },
  duration: {  // in seconds
    type: Number,
    required: [true, 'Duration is required'],
    min: [0, 'Duration cannot be negative'],
  },
  ipAddress: {
    type: String,
    validate: {
      validator: validator.isIP,
      message: 'Invalid IP address format'
    }
  },
  deviceInfo: {
    browser: String,
    os: String,
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown']
    }
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'timed-out', 'abandoned'],
    default: 'completed'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
SubmissionSchema.index({ student: 1, quiz: 1 });
SubmissionSchema.index({ quiz: 1, percentage: -1 });
SubmissionSchema.index({ createdAt: -1 });

// Virtual for time spent per question (average in seconds)
SubmissionSchema.virtual('avgTimePerQuestion').get(function() {
  return this.duration / this.answers.length;
});

// Pre-save hook to calculate duration
SubmissionSchema.pre('save', function(next) {
  if (this.isModified('timeCompleted') || this.isNew) {
    if (!this.timeStarted || !this.timeCompleted) {
      console.error('Missing timeStarted or timeCompleted:', this);
      return next(new Error('timeStarted and timeCompleted are required to calculate duration'));
    }
    this.duration = Math.floor((this.timeCompleted - this.timeStarted) / 1000);
  }
  next();
});

// Static method to get best submission
SubmissionSchema.statics.getBestSubmission = function(studentId, quizId) {
  return this.findOne({ student: studentId, quiz: quizId })
    .sort('-percentage')
    .limit(1);
};

// Instance method to get detailed results
SubmissionSchema.methods.getDetailedResults = function() {
  return {
    score: this.score,
    totalPossible: this.totalPossible,
    percentage: this.percentage,
    passed: this.passed,
    duration: this.duration,
    correctAnswers: this.answers.filter(a => a.isCorrect).length,
    incorrectAnswers: this.answers.filter(a => !a.isCorrect).length,
    avgTimePerQuestion: this.avgTimePerQuestion
  };
};

SubmissionSchema.statics.getAverageScore = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        avgScore: { $avg: '$percentage' }
      }
    }
  ]).then(result => result[0]?.avgScore || 0);
};

module.exports = mongoose.model('Submission', SubmissionSchema);