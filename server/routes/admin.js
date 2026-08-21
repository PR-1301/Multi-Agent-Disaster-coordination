const express = require('express');
const router = express.Router();
const Escalation = require('../models/Escalation');
const EventLog = require('../models/EventLog');
const ClassificationThreshold = require('../models/ClassificationThreshold');
const config = require('../config/adminAgentConfig');

router.get('/llm-accuracy', async (req, res) => {
  try {
    const N = parseInt(req.query.limit) || 100;
    const resolved = await Escalation.find({ resolved: true, was_llm_correct: { $exists: true } })
      .sort({ raised_at: -1 })
      .limit(N);

    if (resolved.length === 0) return res.json({ accuracy: 0, count: 0, breakdown: {} });

    const correct = resolved.filter(e => e.was_llm_correct).length;
    
    // Breakdown by prompt_version and category
    const breakdown = {};
    for (const esc of resolved) {
      const pv = esc.prompt_version || 'unknown_version';
      const cat = esc.original_category_guess || 'unknown_category';
      
      if (!breakdown[pv]) breakdown[pv] = {};
      if (!breakdown[pv][cat]) breakdown[pv][cat] = { total: 0, correct: 0 };
      
      breakdown[pv][cat].total++;
      if (esc.was_llm_correct) breakdown[pv][cat].correct++;
    }

    // Compute accuracy percentages
    for (const pv in breakdown) {
      for (const cat in breakdown[pv]) {
        breakdown[pv][cat].accuracy = breakdown[pv][cat].correct / breakdown[pv][cat].total;
      }
    }

    res.json({ accuracy: correct / resolved.length, count: resolved.length, breakdown });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/capacity-risk', (req, res) => {
  const adminAgent = require('../agents/adminAgent');
  const risks = Object.entries(adminAgent.capacityRisk).map(([sector, data]) => ({
    sector,
    ...data
  })).sort((a, b) => b.risk_score - a.risk_score);
  
  res.json(risks);
});

router.get('/analytics', async (req, res) => {
  try {
    const Case = require('../models/Case');
    const Escalation = require('../models/Escalation');
    const Incident = require('../models/Incident');
    const ClassificationThreshold = require('../models/ClassificationThreshold');
    const EventLog = require('../models/EventLog');
    
    // Case counts
    const statusCounts = await Case.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const catCounts = await Case.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    
    // Escalation breakdown
    const totalCases = await Case.countDocuments();
    const totalEscalations = await Escalation.countDocuments();
    const escalationRate = totalCases > 0 ? totalEscalations / totalCases : 0;
    const escReasons = await Escalation.aggregate([{ $group: { _id: '$reason_taxonomy', count: { $sum: 1 } } }]);

    // Circuit breaker state changes (last 24h)
    const recentCircuitLogs = await EventLog.find({ 
      event: 'circuit.state_changed', 
      created_at: { $gt: new Date(Date.now() - 24*60*60*1000) } 
    }).sort({ created_at: -1 }).limit(50);

    // Active incidents by severity
    const activeIncidents = await Incident.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);

    // Current thresholds
    const thresholds = await ClassificationThreshold.find();

    res.json({
      cases: { by_status: statusCounts, by_category: catCounts },
      escalations: { rate: escalationRate, total: totalEscalations, by_reason: escReasons },
      circuit_breaker_changes_24h: recentCircuitLogs,
      active_incidents: activeIncidents,
      thresholds
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recalibrate', async (req, res) => {
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const adminAgent = require('../agents/adminAgent');
    const results = await adminAgent.runRecalibration('manual');
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Development hook for mockBidder.js to inject bids into the agentBus
router.post('/bids', (req, res) => {
  const agentBus = require('../services/agentBus');
  agentBus.emitEvent('facility.bid', req.body.case_id, req.body);
  res.sendStatus(200);
});

router.get('/feedback-summary', async (req, res) => {
  try {
    const Case = require('../models/Case');
    const feedback = await Case.aggregate([
      { $match: { operator_feedback: { $exists: true } } },
      { $group: { _id: '$operator_feedback.rating', count: { $sum: 1 } } }
    ]);
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/parse-query', async (req, res) => {
  try {
    const adminAgent = require('../agents/adminAgent');
    const filterParams = await adminAgent.parseQuery(req.body.query);
    res.json({ filterParams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
