const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  incident_id: { type: String, required: true, unique: true },
  sector_id: { type: String, required: true },
  case_ids: [{ type: String }],
  severity: { type: String, enum: ['minor', 'moderate', 'major', 'mass_casualty'], default: 'minor' },
  status: { type: String, enum: ['active', 'resolved'], default: 'active' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Incident', incidentSchema);
