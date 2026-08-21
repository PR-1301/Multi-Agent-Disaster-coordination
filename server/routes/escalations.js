const express = require('express');
const router = express.Router();
const Escalation = require('../models/Escalation');
const adminAgent = require('../agents/adminAgent');

router.get('/', async (req, res) => {
  try {
    const escalations = await Escalation.find({ resolved: false }).sort({ raised_at: -1 });
    res.json(escalations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const { decision, notes } = req.body;
    if (!['hospital', 'ngo', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }
    
    const success = await adminAgent.resolveEscalation(req.params.id, decision, notes);
    if (!success) {
      return res.status(404).json({ error: 'Escalation not found or already resolved' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
