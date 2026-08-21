const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  case_id: { type: String, required: true, unique: true },
  sector_id: { type: String, required: true },
  category: { type: String, enum: ['medical', 'shelter', 'rescue', 'mixed', 'unknown', 'pending'], default: 'pending' },
  urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  status: { type: String, enum: ['intake', 'routed', 'assigned', 'resolved', 'escalated', 'rejected'], default: 'intake' },
  assigned_facility_id: { type: String },
  assigned_facility_type: { type: String, enum: ['hospital', 'ngo', 'none'] },
  created_at: { type: Date, default: Date.now },
  resolved_at: { type: Date }
});

module.exports = mongoose.model('Case', caseSchema);
