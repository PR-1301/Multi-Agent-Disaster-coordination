const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sector_id: { type: String, default: 'sector_central' },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  bed_count: { type: Number, default: 0 },
  icu_count: { type: Number, default: 0 },
  ambulance_count: { type: Number, default: 0 }
});

module.exports = mongoose.model('Hospital', hospitalSchema);
