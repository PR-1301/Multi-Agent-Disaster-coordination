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
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
