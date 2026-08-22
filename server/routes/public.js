const express = require('express');
const router = express.Router();
const complaintAgent = require('../agents/complaintAgent');
const Case = require('../models/Case');
const Complaint = require('../models/Complaint');

// POST /api/public/request - Submit a request from public intake
router.post('/request', async (req, res) => {
  try {
    const { name, contact, description, category_hint, location } = req.body;
    
    // Generate a simple caller reference if contact is missing
    const caller_ref = contact || name || `ANON-${Math.floor(Math.random() * 10000)}`;
    
    const payload = {
      sector_id: req.body.sector_id || 'unknown', // Typically public intake won't know sector, can guess based on location
      caller_ref,
      description,
      urgency: 'high', // Default urgency, let triage decide
      location: location || { lat: 0, lng: 0 },
      source_command_center: 'PUBLIC_INTAKE'
    };

    const result = await complaintAgent.handleNewComplaint(payload);
    
    // The reference code could be the case_id or a shorter prefix
    res.status(201).json({
      success: true,
      referenceCode: result.case_id,
      message: 'Request received and is being triaged.'
    });
  } catch (error) {
    console.error('Error in public intake:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/public/status/:refCode - Get status of a public request
router.get('/status/:refCode', async (req, res) => {
  try {
    const { refCode } = req.params;
    
    const c = await Case.findOne({ case_id: refCode });
    const complaint = await Complaint.findOne({ case_id: refCode }).sort({ created_at: -1 });
    
    if (!c && !complaint) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Determine plain-language stage
    // Received / Reviewed / Routed / In Progress / Resolved
    let stage = 'Received';
    if (c) {
      if (c.status === 'intake') stage = 'Received';
      else if (c.status === 'escalated') stage = 'Reviewed'; // Escalated means human in loop, reviewed but not yet routed
      else if (c.status === 'routed') stage = 'Routed';
      else if (c.status === 'assigned') stage = 'In Progress';
      else if (c.status === 'resolved') stage = 'Resolved';
    } else if (complaint && complaint.status === 'flagged_for_review') {
      stage = 'Received';
    }
    
    let summary = null;
    let facility = null;

    if (c) {
      if (c.status === 'resolved') {
         summary = c.resolution_summary || 'Your request has been resolved.';
      }
      if (c.status === 'assigned' || c.status === 'resolved') {
        facility = c.assigned_facility_name || c.assigned_facility_id;
      }
    }

    res.json({
      referenceCode: refCode,
      stage,
      status: c ? c.status : complaint.status,
      category: c ? c.category : null,
      summary,
      facility,
      created_at: c ? c.created_at : complaint.created_at
    });

  } catch (error) {
    console.error('Error fetching public status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
