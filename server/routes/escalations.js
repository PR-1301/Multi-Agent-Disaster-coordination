const express = require('express');
const router = express.Router();
const Escalation = require('../models/Escalation');
const adminAgent = require('../agents/adminAgent');

router.get('/', async (req, res) => {
  try {
    const config = require('../config/adminAgentConfig');
    const cutoff = new Date(Date.now() - config.UNDO_WINDOW_MS);
    const escalations = await Escalation.find({
      $or: [
        { resolved: false },
        { resolved: true, resolved_at: { $gt: cutoff } }
      ]
    }).sort({ raised_at: -1 });
    res.json(escalations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/undo', async (req, res) => {
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const adminAgent = require('../agents/adminAgent');
    const success = await adminAgent.undoEscalation(req.params.id);
    if (!success) return res.status(404).json({ error: 'Not found or not resolved' });
    res.json({ success: true });
  } catch (error) {
    res.status(error.message === 'Undo window expired' ? 400 : 500).json({ error: error.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { decision, notes } = req.body;
    if (!['hospital', 'ngo', 'reject', 'retry'].includes(decision)) {
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
