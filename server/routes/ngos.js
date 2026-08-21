const express = require('express');
const router = express.Router();
const Ngo = require('../models/Ngo');
const agentBus = require('../services/agentBus');

router.get('/', async (req, res) => {
  try {
    const ngos = await Ngo.find();
    res.json(ngos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/availability', async (req, res) => {
  try {
    const { food_units, shelter_capacity, supply_units } = req.body;
    const ngo = await Ngo.findById(req.params.id);
    if (!ngo) return res.status(404).json({ error: 'NGO not found' });

    if (food_units !== undefined) ngo.food_units = food_units;
    if (shelter_capacity !== undefined) ngo.shelter_capacity = shelter_capacity;
    if (supply_units !== undefined) ngo.supply_units = supply_units;
    
    await ngo.save();
    agentBus.emitEvent('ngo.availability.updated', null, ngo);
    
    res.json(ngo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
