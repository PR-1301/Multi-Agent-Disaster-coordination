const mongoose = require('mongoose');

const escalationSchema = new mongoose.Schema({
  case_id: { type: String, required: true },
  reason: { type: String, required: true },
  raised_at: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolved_by: { type: String },
  decision: { type: String }
});

module.exports = mongoose.model('Escalation', escalationSchema);
