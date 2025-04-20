const mongoose = require('mongoose');
const validator = require('validator');

const QuestionSchema = new mongoose.Schema({
  questionText: { 
    type: String, 
    required: [true, 'Question text is required'],
    trim: true,
    minlength: [10, 'Question text must be at least 10 characters'],
    maxlength: [500, 'Question text cannot exceed 500 characters']
  },
  options: [{ 
    type: String, 
    required: [true, 'Option text is required'],
    trim: true,
    minlength: [1, 'Option text must be at least 1 character'],
    maxlength: [200, 'Option text cannot exceed 200 characters']
  }],
  correctAnswer: { 
    type: Number, 
    required: [true, 'Correct answer index is required'],
    min: [0, 'Correct answer index cannot be negative'],
    validate: {
      validator: function(value) {
        return value < this.options.length;
      },
      message: 'Correct answer index must be within options range'
    }
  },
  points: { 
    type: Number, 
    default: 1,
    min: [1, 'Points must be at least 1'],
    max: [10, 'Points cannot exceed 10']
  },
  explanation: {
    type: String,
    trim: true,
    maxlength: [500, 'Explanation cannot exceed 500 characters']
  }
}, { _id: true });

const QuizSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters'],
    unique: true
  },
  description: { 
    type: String, 
    default: '',
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  questions: {
    type: [QuestionSchema],
    validate: {
      validator: function(value) {
        return value.length > 0;
      },
      message: 'Quiz must have at least one question'
    }
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Creator ID is required'] 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  order: { 
    type: Number, 
    required: [true, 'Order is required'],
    min: [1, 'Order must be at least 1']
  },
  passingScore: {
    type: Number,
    default: 70,
    min: [0, 'Passing score cannot be negative'],
    max: [100, 'Passing score cannot exceed 100']
  },
  timeLimit: { 
    type: Number, 
    min: [1, 'Time limit must be at least 1 minute'],
    max: [180, 'Time limit cannot exceed 180 minutes']
  },
  maxAttempts: {
    type: Number,
    default: 1,
    min: [1, 'Max attempts must be at least 1']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [20, 'Tag cannot exceed 20 characters']
  }],
  category: {
    type: String,
    trim: true,
    maxlength: [50, 'Category cannot exceed 50 characters']
  },
  difficulty: {
    type: String,
    enum: {
      values: ['easy', 'medium', 'hard'],
      message: 'Difficulty must be easy, medium, or hard'
    },
    default: 'medium'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
QuizSchema.index({ title: 'text', description: 'text' });
QuizSchema.index({ isActive: 1, order: 1 });
QuizSchema.index({ createdBy: 1 });

// Virtual for total points
QuizSchema.virtual('totalPoints').get(function() {
  return this.questions.reduce((sum, question) => sum + question.points, 0);
});

// Update timestamp on save
QuizSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Cascade delete submissions when quiz is deleted
QuizSchema.pre('remove', async function(next) {
  await mongoose.model('Submission').deleteMany({ quiz: this._id });
  next();
});

// Static method for search
QuizSchema.statics.search = async function(query) {
  return this.find({ $text: { $search: query } })
    .sort({ score: { $meta: 'textScore' } });
};

// Instance method to check if user can attempt
QuizSchema.methods.canAttempt = function(userId) {
  if (!this.isActive) return false;
  
  return mongoose.model('Submission').countDocuments({ 
    student: userId, 
    quiz: this._id 
  }).then(count => count < this.maxAttempts);
};

QuizSchema.statics.getMostPopular = function() {
  return this.aggregate([
    {
      $lookup: {
        from: 'submissions',
        localField: '_id',
        foreignField: 'quiz',
        as: 'submissions'
      }
    },
    {
      $project: {
        title: 1,
        submissionCount: { $size: '$submissions' }
      }
    },
    { $sort: { submissionCount: -1 } },
    { $limit: 1 }
  ]);
};

module.exports = mongoose.model('Quiz', QuizSchema);