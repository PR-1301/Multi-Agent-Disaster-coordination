const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  case_id: { type: String, required: true, unique: true, index: true },
  sector_id: { type: String, required: true, index: true },
  urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  status: { type: String, enum: ['intake', 'routed', 'assigned', 'resolved', 'escalated', 'rejected', 'pending', 'deferred'], default: 'intake', index: true },
  priority_score: { type: Number, default: 0, index: true },
  incident_id: { type: String, index: true },
  category: { type: String, enum: ['medical', 'shelter', 'rescue', 'mixed', 'unknown', 'pending'], default: 'pending' },
  extracted_signals: { type: mongoose.Schema.Types.Mixed },
  assigned_facility_id: { type: String },
  assigned_facility_type: { type: String, enum: ['hospital', 'ngo', 'none'] },
  prompt_version: { type: String },
  retries_count: { type: Number, default: 0 },
  operator_feedback: { 
    rating: { type: String, enum: ['up', 'down'] },
    note: { type: String }
  },
  created_at: { type: Date, default: Date.now },
  resolved_at: { type: Date }
});

module.exports = mongoose.model('Case', caseSchema);
