const express = require('express');
const router = express.Router();
const complaintAgent = require('../agents/complaintAgent');

// GET /api/complaints/flagged - List complaints awaiting human review
router.get('/flagged', async (req, res) => {
  try {
    const flagged = await complaintAgent.getFlaggedComplaints();
    res.json(flagged);
  } catch (error) {
    console.error('Error fetching flagged complaints:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/complaints/:id/clear-flag - Human operator clears flag, re-emits case.created
router.post('/:id/clear-flag', async (req, res) => {
  try {
    const result = await complaintAgent.clearComplaintFlag(req.params.id);
    res.json(result);
  } catch (error) {
    console.error(`Error clearing flag for complaint ${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/complaints - Main complaint submission endpoint
router.post('/', async (req, res) => {
  try {
    const result = await complaintAgent.handleNewComplaint(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
