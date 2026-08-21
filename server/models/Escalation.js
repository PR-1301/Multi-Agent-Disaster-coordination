const mongoose = require('mongoose');

const escalationSchema = new mongoose.Schema({
  case_id: { type: String, required: true },
  incident_id: { type: String },
  reason_taxonomy: { type: String, enum: ['low_confidence', 'mixed_category', 'unknown_category', 'assignment_failed', 'duplicate_conflict', 'manual_flag'] },
  reason: { type: String, required: true },
  original_category_guess: { type: String },
  was_llm_correct: { type: Boolean },
  prompt_version: { type: String },
  raised_at: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolved_by: { type: String },
  resolved_at: { type: Date },
  decision: { type: String },
  plain_summary: { type: String }
});

module.exports = mongoose.model('Escalation', escalationSchema);
