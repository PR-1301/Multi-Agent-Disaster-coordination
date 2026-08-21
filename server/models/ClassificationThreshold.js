const mongoose = require('mongoose');
const thresholdSchema = new mongoose.Schema({
  category: { type: String, required: true, unique: true },
  threshold: { type: Number, required: true },
  sample_size: { type: Number, default: 0 },
  last_updated: { type: Date, default: Date.now }
});
module.exports = mongoose.model('ClassificationThreshold', thresholdSchema);
