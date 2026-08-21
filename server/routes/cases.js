const express = require('express');
const router = express.Router();
const Case = require('../models/Case');

router.get('/', async (req, res) => {
  try {
    const { sort, sector_id, urgency, status } = req.query;
    let sortObj = { priority_score: -1, created_at: -1 };
    if (sort === 'time') {
      sortObj = { created_at: -1 };
    }
    
    let filterObj = {};
    if (sector_id) filterObj.sector_id = sector_id;
    if (urgency) filterObj.urgency = urgency;
    if (status) filterObj.status = status;
    
    const cases = await Case.find(filterObj).sort(sortObj);
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const c = await Case.findOne({ case_id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Case not found' });
    res.json(c);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const EventLog = require('../models/EventLog');
    const logs = await EventLog.find({ case_id: req.params.id }).sort({ created_at: 1 });
    
    const timeline = logs.map(log => {
      const timeStr = new Date(log.created_at).toLocaleTimeString('en-US', { hour12: false });
      let message = log.event;
      
      switch (log.event) {
        case 'case.classification_path':
          const { path, classification } = log.payload;
          message = `adminAgent classified as ${classification.category} (confidence ${classification.confidence}) via ${path}`;
          break;
        case 'case.routed':
          message = `Routed to ${log.payload.target} (Priority: ${log.payload.priority_score})`;
          break;
        case 'escalation.raised':
          message = `Escalation raised: ${log.payload.reason}`;
          break;
        case 'assignment.confirmed':
          message = `Assigned to ${log.payload.facility_type} (${log.payload.facility_name})`;
          break;
        case 'assignment.failed':
          message = `Assignment failed for ${log.payload.target}: ${log.payload.reason}`;
          break;
        case 'case.resolved':
          message = `Case resolved`;
          break;
        case 'rescue.requested':
          message = `Rescue requested`;
          break;
      }
      return `[${timeStr}] ${message}`;
    });
    
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/explain', async (req, res) => {
  try {
    const c = await Case.findOne({ case_id: req.params.id });
    if (!c) return res.status(404).json({ error: 'Case not found' });
    
    const adminAgent = require('../agents/adminAgent');
    const prompt = `Generate a 1-2 sentence plain-language summary for a human operator explaining the routing of this case.
Category: ${c.category}
Status: ${c.status}
Priority: ${c.priority_score}
Assigned to: ${c.assigned_facility_type} (${c.assigned_facility_id})
Keep it short, clear, and actionable.`;

    let plain_summary = `Case is ${c.status} in category ${c.category}.`;
    const llmRes = await adminAgent.callLLMWithRetry(prompt);
    if (llmRes.path !== 'fallback' && llmRes.data) {
       plain_summary = llmRes.data.trim();
    }
    
    res.json({
      case_id: c.case_id,
      category: c.category,
      priority_score: c.priority_score,
      signals: c.extracted_signals,
      status: c.status,
      assigned_facility_type: c.assigned_facility_type,
      assigned_facility_id: c.assigned_facility_id,
      plain_summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/feedback', async (req, res) => {
  try {
    const { rating, note } = req.body;
    const adminAgent = require('../agents/adminAgent');
    await adminAgent.addFeedback(req.params.id, rating, note);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
