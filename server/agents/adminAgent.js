const Case = require('../models/Case');
const Escalation = require('../models/Escalation');
const agentBus = require('../services/agentBus');
const { callLLM } = require('../services/llmClient');

class AdminAgent {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    agentBus.on('case.created', async ({ case_id, payload }) => {
      this.handleCaseCreated(case_id, payload);
    });

    agentBus.on('assignment.confirmed', async ({ case_id, payload }) => {
      await Case.updateOne(
        { case_id },
        { 
          status: 'resolved', 
          resolved_at: new Date(),
          assigned_facility_id: payload.facility_id,
          assigned_facility_type: payload.facility_type
        }
      );
      agentBus.emitEvent('case.resolved', case_id, payload);
    });

    agentBus.on('assignment.failed', async ({ case_id, payload }) => {
      await Escalation.create({
        case_id,
        reason: `Assignment failed for target: ${payload.target}`
      });
      await Case.updateOne({ case_id }, { status: 'escalated' });
      agentBus.emitEvent('escalation.raised', case_id, { reason: 'assignment.failed', payload });
    });
  }

  async handleCaseCreated(case_id, payload) {
    let classification = null;

    try {
      if (process.env.LLM_API_KEY) {
        const prompt = `Classify the following disaster complaint. 
Description: "${payload.description}"
Urgency: "${payload.urgency}"
Respond ONLY with a JSON object: { "category": "medical" | "shelter" | "rescue" | "mixed" | "unknown", "confidence": <float 0-1>, "reasoning": "<string>" }`;
        classification = await callLLM(prompt);
      }
    } catch (error) {
      console.warn(`[adminAgent] LLM failed, using fallback. Error: ${error.message}`);
    }

    // Fallback keyword classifier
    if (!classification) {
      const desc = (payload.description || '').toLowerCase();
      let category = 'unknown';
      if (desc.includes('bleed') || desc.includes('injur') || desc.includes('heart') || desc.includes('breath')) {
        category = 'medical';
      } else if (desc.includes('house') || desc.includes('homeless') || desc.includes('food') || desc.includes('cold') || desc.includes('shelter')) {
        category = 'shelter';
      } else if (desc.includes('trapped') || desc.includes('drown') || desc.includes('fire')) {
        category = 'rescue';
      }
      
      classification = {
        category,
        confidence: category === 'unknown' ? 0 : 0.8,
        reasoning: 'Fallback keyword classification'
      };
    }

    const { category, confidence } = classification;
    await Case.updateOne({ case_id }, { category });

    if (confidence >= 0.75 && (category === 'medical' || category === 'shelter')) {
      const target = category === 'medical' ? 'hospital' : 'ngo';
      await Case.updateOne({ case_id }, { status: 'routed' });
      agentBus.emitEvent('case.routed', case_id, { target, urgency: payload.urgency, location: payload.location });
    } else if (category === 'rescue') {
      agentBus.emitEvent('rescue.requested', case_id, { location: payload.location, description: payload.description });
    } else {
      await Escalation.create({
        case_id,
        reason: `Low confidence (${confidence}) or ambiguous category (${category})`
      });
      await Case.updateOne({ case_id }, { status: 'escalated' });
      agentBus.emitEvent('escalation.raised', case_id, { reason: 'classification_ambiguous', classification });
    }
  }

  async resolveEscalation(escalation_id, decision, notes) {
    const escalation = await Escalation.findById(escalation_id);
    if (!escalation || escalation.resolved) return false;

    escalation.resolved = true;
    escalation.decision = decision;
    escalation.resolved_by = 'operator';
    await escalation.save();

    const case_id = escalation.case_id;

    if (decision === 'hospital' || decision === 'ngo') {
      const c = await Case.findOne({ case_id });
      const Complaint = require('../models/Complaint');
      const comp = await Complaint.findOne({ case_id }).sort({ created_at: -1 });
      
      await Case.updateOne({ case_id }, { status: 'routed' });
      agentBus.emitEvent('case.routed', case_id, { target: decision, urgency: c.urgency, location: comp.location });
    } else if (decision === 'reject') {
      await Case.updateOne({ case_id }, { status: 'rejected', resolved_at: new Date() });
      agentBus.emitEvent('case.resolved', case_id, { reason: 'rejected_by_operator', notes });
    }
    return true;
  }
}

module.exports = new AdminAgent();
