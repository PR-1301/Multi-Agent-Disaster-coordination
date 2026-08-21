const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  bed_count: { type: Number, default: 0 },
  icu_count: { type: Number, default: 0 },
  ambulance_count: { type: Number, default: 0 }
});

module.exports = mongoose.model('Hospital', hospitalSchema);
