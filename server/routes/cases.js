const express = require('express');
const router = express.Router();
const Case = require('../models/Case');

router.get('/', async (req, res) => {
  try {
    const cases = await Case.find().sort({ created_at: -1 });
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

module.exports = router;
