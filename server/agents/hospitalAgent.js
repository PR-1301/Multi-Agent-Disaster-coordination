const Hospital = require('../models/Hospital');
const agentBus = require('../services/agentBus');
const { getDistance } = require('../services/geo');

class HospitalAgent {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    agentBus.on('case.routed', async ({ case_id, payload }) => {
      if (payload.target === 'hospital') {
        this.handleRouting(case_id, payload);
      }
    });
  }

  async handleRouting(case_id, payload) {
    const { urgency, location } = payload;
    
    // Find hospitals with available capacity
    let query = {};
    if (urgency === 'critical') {
      query.icu_count = { $gt: 0 };
    } else {
      query.bed_count = { $gt: 0 };
    }

    const hospitals = await Hospital.find(query);

    if (hospitals.length === 0) {
      agentBus.emitEvent('assignment.failed', case_id, { target: 'hospital', reason: 'No capacity' });
      return;
    }

    // Sort by nearest
    hospitals.sort((a, b) => {
      const distA = getDistance(location.lat, location.lng, a.location.lat, a.location.lng);
      const distB = getDistance(location.lat, location.lng, b.location.lat, b.location.lng);
      return distA - distB;
    });

    const selected = hospitals[0];

    // Decrement capacity
    if (urgency === 'critical') {
      selected.icu_count -= 1;
    } else {
      selected.bed_count -= 1;
    }
    await selected.save();

    agentBus.emitEvent('hospital.availability.updated', null, selected);

    agentBus.emitEvent('assignment.confirmed', case_id, {
      facility_id: selected._id,
      facility_type: 'hospital',
      facility_name: selected.name
    });
  }
}

module.exports = new HospitalAgent();
