const Ngo = require('../models/Ngo');
const agentBus = require('../services/agentBus');
const { getDistance } = require('../services/geo');

class NgoAgent {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    agentBus.on('case.routed', async ({ case_id, payload }) => {
      if (payload.target === 'ngo') {
        this.handleRouting(case_id, payload);
      }
    });
  }

  async handleRouting(case_id, payload) {
    const { urgency, location } = payload; // Can use urgency to map to supply_units/food_units/shelter
    
    // For simplicity MVP, we just need shelter capacity > 0 OR food_units > 0
    const ngos = await Ngo.find({
      $or: [
        { shelter_capacity: { $gt: 0 } },
        { food_units: { $gt: 0 } },
        { supply_units: { $gt: 0 } }
      ]
    });

    if (ngos.length === 0) {
      agentBus.emitEvent('assignment.failed', case_id, { target: 'ngo', reason: 'No capacity' });
      return;
    }

    // Sort by nearest
    ngos.sort((a, b) => {
      const distA = getDistance(location.lat, location.lng, a.location.lat, a.location.lng);
      const distB = getDistance(location.lat, location.lng, b.location.lat, b.location.lng);
      return distA - distB;
    });

    const selected = ngos[0];

    // Simple deduction
    if (selected.shelter_capacity > 0) {
      selected.shelter_capacity -= 1;
    } else if (selected.food_units > 0) {
      selected.food_units -= 1;
    } else if (selected.supply_units > 0) {
      selected.supply_units -= 1;
    }
    
    await selected.save();

    agentBus.emitEvent('ngo.availability.updated', null, selected);

    agentBus.emitEvent('assignment.confirmed', case_id, {
      facility_id: selected._id,
      facility_type: 'ngo',
      facility_name: selected.name
    });
  }
}

module.exports = new NgoAgent();
