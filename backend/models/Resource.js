const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  url: { type: String, required: true, trim: true, maxlength: 2000 },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Resource', ResourceSchema);

