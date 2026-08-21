const express = require('express');
const router = express.Router();
const Incident = require('../models/Incident');
const Case = require('../models/Case');

router.get('/', async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ created_at: -1 });
    res.json(incidents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const incident = await Incident.findOne({ incident_id: req.params.id });
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    
    const cases = await Case.find({ incident_id: incident.incident_id });
    res.json({ ...incident.toObject(), cases });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/sitrep', async (req, res) => {
  try {
    const incident = await Incident.findOne({ incident_id: req.params.id });
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    
    const cases = await Case.find({ incident_id: incident.incident_id });
    const adminAgent = require('../agents/adminAgent');
    
    let trapped = 0;
    let structural = 0;
    
    cases.forEach(c => {
      if (c.extracted_signals?.trapped_or_immobile) trapped++;
      if (c.extracted_signals?.structural_damage) structural++;
    });

    const fallbackSummary = `${cases.length} linked cases in ${incident.sector_id}. ${trapped} report trapped persons, ${structural} report structural damage. Severity: ${incident.severity}. Recommend prioritizing rescue and sector capacity.`;
    
    const prompt = `Generate a short situation report (sitrep) for this disaster cluster:
Sector: ${incident.sector_id}
Total Cases: ${cases.length}
Severity: ${incident.severity}
Trapped persons reported in ${trapped} cases.
Structural damage reported in ${structural} cases.
Keep it under 3 sentences, professional and action-oriented.`;

    const llmRes = await adminAgent.callLLMWithRetry(prompt);
    
    let sitrep = fallbackSummary;
    if (llmRes.path !== 'fallback' && llmRes.data) {
      sitrep = llmRes.data.trim();
    }

    res.json({ incident_id: incident.incident_id, sitrep, source: llmRes.path });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/resolve-all', async (req, res) => {
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { decision, notes } = req.body;
    const adminAgent = require('../agents/adminAgent');
    const count = await adminAgent.resolveIncidentAll(req.params.id, decision, notes);
    res.json({ success: true, resolved_count: count });
  } catch (error) {
    res.status(error.message === 'Incident not found' ? 404 : 500).json({ error: error.message });
  }
});

module.exports = router;
