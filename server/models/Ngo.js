const mongoose = require('mongoose');

const ngoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sector_id: { type: String, default: 'sector_central' },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  food_units: { type: Number, default: 0 },
  shelter_capacity: { type: Number, default: 0 },
  supply_units: { type: Number, default: 0 }
});

module.exports = mongoose.model('Ngo', ngoSchema);
