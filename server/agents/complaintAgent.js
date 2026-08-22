const crypto = require('crypto');
const Complaint = require('../models/Complaint');
const Case = require('../models/Case');
const RescueRequest = require('../models/RescueRequest');
const agentBus = require('../services/agentBus');
const { getDistance } = require('../services/geo');
const {
  screenComplaintQuality,
  normalizeLanguage,
  extractStructuredComplaint,
  detectSemanticDuplicate,
  assessUrgency
} = require('../services/complaintIntel');

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

    // 1. Stage 1: Quality / Spam screening
    let recentCallerComplaints = [];
    if (caller_ref) {
      recentCallerComplaints = await Complaint.find({ caller_ref }).sort({ created_at: -1 }).limit(10);
    }

    const qualityRes = await screenComplaintQuality(data, recentCallerComplaints);
    console.log(`[complaint-agent] quality_screen valid: ${qualityRes.is_valid}, reason: ${qualityRes.reason || 'none'}`);

    if (!qualityRes.is_valid) {
      const tempCaseId = `flagged-${crypto.randomUUID()}`;
      const flaggedComplaint = await Complaint.create({
        case_id: tempCaseId,
        sector_id: sector_id || 'unknown',
        caller_ref: caller_ref || 'unknown',
        description: description || 'Flagged submission',
        urgency: urgency || 'low',
        location: location || { lat: 0, lng: 0 },
        source_command_center,
        status: 'flagged_for_review',
        quality_flag: 'flagged_for_review',
        triage_score: 1,
        triage_source: 'heuristic',
        original_language: 'unknown',
        original_text: description || '',
        duplicate_check_method: 'heuristic'
      });

      console.log(`[complaint-agent] Complaint ${flaggedComplaint._id} flagged for review. Skipping case creation.`);
      return {
        case_id: tempCaseId,
        complaint_id: flaggedComplaint._id,
        duplicate: false,
        status: 'flagged_for_review',
        quality_flag: 'flagged_for_review'
      };
    }

    // Basic payload check for valid processing
    if (!sector_id || !caller_ref || !description || !urgency || !location || location.lat === undefined || location.lng === undefined) {
      throw new Error('Invalid payload');
    }

    // 2. Stage 2: Language normalization
    const langRes = await normalizeLanguage(description);
    console.log(`[complaint-agent] language_normalize lang: ${langRes.original_language}, method: ${langRes.method}`);
    const processedText = langRes.english_description;

    // 3. Stage 3: Structured extraction (will be run in parallel)

    // 4. Stage 4: Duplicate detection (Spatial-Temporal pre-filter + Semantic check)
    const recentCases = await Case.find({
      sector_id,
      status: { $in: ['intake', 'routed', 'assigned', 'escalated'] },
      created_at: { $gt: new Date(Date.now() - DUPLICATE_TIME_WINDOW_MS) }
    });

    let candidateComplaints = [];
    for (const c of recentCases) {
      const relatedComplaint = await Complaint.findOne({ case_id: c.case_id }).sort({ created_at: -1 });
      if (relatedComplaint && relatedComplaint.location) {
        const dist = getDistance(location.lat, location.lng, relatedComplaint.location.lat, relatedComplaint.location.lng);
        if (dist <= DUPLICATE_RADIUS_KM) {
          candidateComplaints.push({
            case_id: c.case_id,
            description: relatedComplaint.description,
            distance_km: dist
          });
        }
      }
    }

    const [structRes, dupRes, triageRes] = await Promise.all([
      extractStructuredComplaint(processedText),
      detectSemanticDuplicate(processedText, candidateComplaints),
      assessUrgency(processedText, urgency)
    ]);
    
    console.log(`[complaint-agent] structured_extraction keywords: [${structRes.keywords.join(', ')}], method: ${structRes.method}`);
    console.log(`[complaint-agent] duplicate_check is_duplicate: ${dupRes.is_duplicate}, method: ${dupRes.method}, matched_case: ${dupRes.matched_case_id || 'none'}`);
    console.log(`[complaint-agent] urgency_triage triage_score: ${triageRes.triage_score}, source: ${triageRes.triage_source}`);

    const duplicateCaseId = dupRes.is_duplicate ? dupRes.matched_case_id : null;
    const case_id = duplicateCaseId || crypto.randomUUID();

    // Create Case document if new
    if (!duplicateCaseId) {
      await Case.create({
        case_id,
        sector_id,
        urgency,
        status: 'intake'
      });
    }

    // Save Complaint document
    const complaint = await Complaint.create({
      case_id,
      sector_id,
      caller_ref,
      description,
      urgency,
      location,
      source_command_center,
      status: 'open',
      triage_score: triageRes.triage_score,
      triage_source: triageRes.triage_source,
      original_language: langRes.original_language,
      original_text: langRes.original_text,
      duplicate_check_method: dupRes.method,
      quality_flag: 'ok'
    });

    // Panic / distress signal -> fast-track escalation hint
    if (triageRes.distress_signal) {
      console.log(`[complaint-agent] distress_flagged signal: "${triageRes.distress_signal}", case: ${case_id}`);
      agentBus.emitEvent('complaint.distress_flagged', case_id, {
        case_id,
        signal: triageRes.distress_signal,
        triage_score: triageRes.triage_score
      });
    }

    // Emit standard case.created event if not duplicate
    if (!duplicateCaseId) {
      agentBus.emitEvent('case.created', case_id, {
        description,
        urgency,
        location,
        sector_id,
        intake_metadata: {
          triage_score: triageRes.triage_score,
          triage_source: triageRes.triage_source,
          duplicate_check_method: dupRes.method,
          original_language: langRes.original_language
        }
      });
    }

    return {
      case_id,
      complaint_id: complaint._id,
      duplicate: !!duplicateCaseId,
      triage_score: triageRes.triage_score,
      quality_flag: 'ok'
    };
  }

  async getFlaggedComplaints() {
    return await Complaint.find({ quality_flag: 'flagged_for_review' }).sort({ created_at: -1 });
  }

  async clearComplaintFlag(complaintId) {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      throw new Error('Complaint not found');
    }

    if (complaint.quality_flag !== 'flagged_for_review') {
      return { message: 'Complaint is not flagged for review', complaint };
    }

    let case_id = complaint.case_id;
    if (case_id.startsWith('flagged-')) {
      case_id = crypto.randomUUID();
      complaint.case_id = case_id;
    }

    complaint.quality_flag = 'ok';
    complaint.status = 'open';
    await complaint.save();

    // Create case in database if it doesn't exist
    let existingCase = await Case.findOne({ case_id });
    if (!existingCase) {
      await Case.create({
        case_id,
        sector_id: complaint.sector_id,
        urgency: complaint.urgency,
        status: 'intake'
      });
    } else {
      await Case.updateOne({ case_id }, { status: 'intake' });
    }

    console.log(`[complaint-agent] Flag cleared for complaint ${complaintId}. Emitting case.created for case ${case_id}.`);

    // Re-emit case.created event so adminAgent processes it
    agentBus.emitEvent('case.created', case_id, {
      description: complaint.description,
      urgency: complaint.urgency,
      location: complaint.location,
      sector_id: complaint.sector_id,
      intake_metadata: {
        triage_score: complaint.triage_score || 3,
        triage_source: complaint.triage_source || 'heuristic',
        duplicate_check_method: complaint.duplicate_check_method || 'heuristic',
        original_language: complaint.original_language || 'en'
      }
    });

    return { message: 'Flag cleared successfully', case_id, complaint };
  }
}

module.exports = new ComplaintAgent();
