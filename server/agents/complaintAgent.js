const crypto = require('crypto');
const Complaint = require('../models/Complaint');
const Case = require('../models/Case');
const RescueRequest = require('../models/RescueRequest');
const agentBus = require('../services/agentBus');
const { getDistance } = require('../services/geo');

const DUPLICATE_RADIUS_KM = 2;
const DUPLICATE_TIME_WINDOW_MS = 60 * 60 * 1000; // 1 hour

class ComplaintAgent {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    agentBus.on('case.resolved', async ({ case_id }) => {
      await Complaint.updateMany({ case_id }, { status: 'closed' });
    });

    agentBus.on('rescue.requested', async ({ case_id, payload }) => {
      await RescueRequest.create({ case_id, details: payload });
    });
  }

  async handleNewComplaint(data) {
    const { sector_id, caller_ref, description, urgency, location, source_command_center } = data;
    
    if (!sector_id || !caller_ref || !description || !urgency || !location || location.lat === undefined || location.lng === undefined) {
      throw new Error('Invalid payload');
    }

    // Check for duplicate open case in the same sector within radius/time window
    const recentCases = await Case.find({
      sector_id,
      status: { $in: ['intake', 'routed', 'assigned', 'escalated'] },
      created_at: { $gt: new Date(Date.now() - DUPLICATE_TIME_WINDOW_MS) }
    });

    let duplicateCaseId = null;
    for (const c of recentCases) {
      const relatedComplaint = await Complaint.findOne({ case_id: c.case_id }).sort({ created_at: -1 });
      if (relatedComplaint && relatedComplaint.location) {
        const dist = getDistance(location.lat, location.lng, relatedComplaint.location.lat, relatedComplaint.location.lng);
        if (dist <= DUPLICATE_RADIUS_KM) {
          duplicateCaseId = c.case_id;
          break;
        }
      }
    }

    const case_id = duplicateCaseId || crypto.randomUUID();

    if (!duplicateCaseId) {
      await Case.create({
        case_id,
        sector_id,
        urgency,
        status: 'intake'
      });
    }

    const complaint = await Complaint.create({
      case_id,
      sector_id,
      caller_ref,
      description,
      urgency,
      location,
      source_command_center,
      status: 'open'
    });

    if (!duplicateCaseId) {
      agentBus.emitEvent('case.created', case_id, {
        description, urgency, location, sector_id
      });
    }

    return { case_id, complaint_id: complaint._id, duplicate: !!duplicateCaseId };
  }
}

module.exports = new ComplaintAgent();
