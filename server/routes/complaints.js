const express = require('express');
const router = express.Router();
const complaintAgent = require('../agents/complaintAgent');

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
