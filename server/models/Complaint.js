const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  case_id: { type: String, required: true },
  sector_id: { type: String, required: true },
  caller_ref: { type: String, required: true },
  description: { type: String, required: true },
  urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  source_command_center: { type: String },
  status: { type: String, enum: ['open', 'closed', 'flagged_for_review'], default: 'open' },
  triage_score: { type: Number, min: 1, max: 5 },
  triage_source: { type: String, enum: ['llm', 'heuristic'] },
  original_language: { type: String, default: 'en' },
  original_text: { type: String },
  duplicate_check_method: { type: String, enum: ['llm', 'heuristic'] },
  quality_flag: { type: String, enum: ['ok', 'flagged_for_review'], default: 'ok' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
