const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');
const agentBus = require('../services/agentBus');

router.get('/', async (req, res) => {
  try {
    const hospitals = await Hospital.find();
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/availability', async (req, res) => {
  try {
    const { bed_count, icu_count, ambulance_count } = req.body;
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    if (bed_count !== undefined) hospital.bed_count = bed_count;
    if (icu_count !== undefined) hospital.icu_count = icu_count;
    if (ambulance_count !== undefined) hospital.ambulance_count = ambulance_count;
    
    await hospital.save();
    agentBus.emitEvent('hospital.availability.updated', null, hospital);
    
    res.json(hospital);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
