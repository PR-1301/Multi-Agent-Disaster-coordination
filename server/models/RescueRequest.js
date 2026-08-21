const mongoose = require('mongoose');

const rescueRequestSchema = new mongoose.Schema({
  case_id: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RescueRequest', rescueRequestSchema);
