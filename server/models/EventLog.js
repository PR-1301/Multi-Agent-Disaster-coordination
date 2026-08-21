const mongoose = require('mongoose');

const eventLogSchema = new mongoose.Schema({
  case_id: { type: String },
  event: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EventLog', eventLogSchema);
