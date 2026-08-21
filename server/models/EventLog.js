const mongoose = require('mongoose');

const eventLogSchema = new mongoose.Schema({
  case_id: { type: String, index: true },
  event: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EventLog', eventLogSchema);
