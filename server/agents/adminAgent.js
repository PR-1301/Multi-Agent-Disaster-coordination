const Case = require('../models/Case');
const Escalation = require('../models/Escalation');
const EventLog = require('../models/EventLog');
const Complaint = require('../models/Complaint');
const Incident = require('../models/Incident');
const ClassificationThreshold = require('../models/ClassificationThreshold');
const agentBus = require('../services/agentBus');
const { getDistance } = require('../services/geo');
const crypto = require('crypto');
const { callLLM } = require('../services/llmClient');
const config = require('../config/adminAgentConfig');

function pLimit(concurrency) {
  const queue = [];
  let active = 0;
  
  const next = () => {
    active--;
    if (queue.length > 0) queue.shift()();
  };
  
  const run = async (fn, resolve, reject, args) => {
    active++;
    try {
      resolve(await fn(...args));
    } catch (e) {
      reject(e);
    }
    next();
  };
  
  const enqueue = (fn, ...args) => {
    return new Promise((resolve, reject) => {
      const task = () => run(fn, resolve, reject, args);
      if (active < concurrency) {
        task();
      } else {
        queue.push(task);
      }
    });
  };
  
  Object.defineProperty(enqueue, 'pendingCount', { get: () => queue.length });
  
  return enqueue;
}

class AdminAgent {
  constructor() {
    this.activeBids = {};
    this.capacityHistory = {};
    this.capacityRisk = {};
    this.circuitBreaker = { state: 'closed', failures: 0, openUntil: 0 };
    this.intakeLimiter = pLimit(config.ADMIN_AGENT_CONCURRENCY);
    this.llmLimiter = pLimit(config.LLM_CONCURRENCY);
    this.llmCache = new Map();
    this.llmLatencyHistory = [];
    this.stats = { processedCases: 0, startTime: Date.now() };
    this.setupListeners();
    
    // Scheduled recalibration
    setInterval(() => {
      this.runRecalibration('scheduled').catch(err => console.error('[adminAgent] Scheduled recalibration error:', err));
    }, 5 * 60 * 1000); // 5 minutes
  }

  setupListeners() {
    agentBus.on('facility.bid', (bid) => {
      if (this.activeBids[bid.case_id]) {
        this.activeBids[bid.case_id].push(bid);
      }
    });

    agentBus.on('case.created', async ({ case_id, payload }) => {
      const qDepth = this.intakeLimiter.pendingCount;
      if (qDepth >= config.QUEUE_HARD_CAPACITY) {
        await Case.updateOne({ case_id }, { status: 'deferred' });
        await EventLog.create({
          case_id,
          event: 'case.shed',
          payload: { reason: 'Queue hard capacity reached', capacity: config.QUEUE_HARD_CAPACITY }
        });
        return;
      }
      this.intakeLimiter(() => {
        const start = Date.now();
        return this.handleCaseCreated(case_id, payload, qDepth).then(() => {
          this.stats.processedCases++;
        });
      }).catch(console.error);
    });

    agentBus.on('assignment.confirmed', async ({ case_id, payload }) => {
      await Case.updateOne(
        { case_id },
        { 
          status: 'assigned', 
          assigned_facility_id: payload.facility_id,
          assigned_facility_type: payload.facility_type
        }
      );
      agentBus.emitEvent('case.assigned', case_id, payload);
    });

    agentBus.on('assignment.failed', async ({ case_id, payload }) => {
      this.stats.escalatedCount = (this.stats.escalatedCount || 0) + 1;
      await Escalation.create({
        case_id,
        reason_taxonomy: 'assignment_failed',
        reason: payload.reason || `Assignment failed for target: ${payload.target}`
      });
      await Case.updateOne({ case_id }, { status: 'escalated' });
      agentBus.emitEvent('escalation.raised', case_id, { reason: 'assignment_failed', payload });
    });

    const handleAvailability = ({ payload }) => {
      const facility = payload;
      const sector = facility.sector_id || 'sector_central';
      const cap = (facility.icu_count || 0) + (facility.bed_count || 0) + (facility.shelter_capacity || 0) + (facility.food_units || 0) + (facility.supply_units || 0);
      
      if (!this.capacityHistory[sector]) this.capacityHistory[sector] = [];
      this.capacityHistory[sector].push({ timestamp: Date.now(), capacity: cap });
      
      if (this.capacityHistory[sector].length > config.CAPACITY_RISK_WINDOW_SIZE) {
        this.capacityHistory[sector].shift();
      }
      this.updateCapacityRisk(sector);
    };

    agentBus.on('hospital.availability.updated', handleAvailability);
    agentBus.on('ngo.availability.updated', handleAvailability);
  }

  updateCapacityRisk(sector) {
    const history = this.capacityHistory[sector];
    if (history.length < 2) return;

    const first = history[0];
    const last = history[history.length - 1];
    const trend = (last.capacity - first.capacity) / (history.length - 1);
    
    this.capacityRisk[sector] = {
      risk_score: trend < 0 ? Math.abs(trend) : 0,
      trend,
      current_capacity: last.capacity
    };

    if (trend <= config.CAPACITY_RISK_THRESHOLD) {
      agentBus.emitEvent('capacity.risk_raised', null, { sector, risk_score: this.capacityRisk[sector].risk_score, trend });
    }
  }

  async callLLMWithRetry(prompt) {
    if (this.circuitBreaker.state === 'open') {
      if (Date.now() > this.circuitBreaker.openUntil) {
        this.circuitBreaker.state = 'half-open';
        EventLog.create({ event: 'circuit.state_changed', payload: { from: 'open', to: 'half-open' } }).catch(console.error);
      } else {
        return { data: null, path: 'fallback' };
      }
    }

    return this.llmLimiter(async () => {
      let attempt = 0;
      while (attempt <= config.RETRY_COUNT) {
        try {
          if (process.env.LLM_API_KEY) {
            const start = Date.now();
            const res = await callLLM(prompt);
            const latency = Date.now() - start;
            
            this.llmLatencyHistory.push(latency);
            if (this.llmLatencyHistory.length > 10) this.llmLatencyHistory.shift();
            
            const avgLatency = this.llmLatencyHistory.reduce((a,b)=>a+b, 0) / this.llmLatencyHistory.length;
            
            if (avgLatency > config.LLM_LATENCY_CIRCUIT_BREAKER_MS && this.circuitBreaker.state !== 'open') {
               this.circuitBreaker.state = 'open';
               this.circuitBreaker.openUntil = Date.now() + config.CIRCUIT_BREAKER_COOLDOWN_MS;
               EventLog.create({ event: 'circuit.state_changed', payload: { from: 'closed/half-open', to: 'open', reason: 'high_latency', avgLatency } }).catch(console.error);
            }

            if (this.circuitBreaker.state === 'half-open') {
              this.circuitBreaker.state = 'closed';
              this.circuitBreaker.failures = 0;
              EventLog.create({ event: 'circuit.state_changed', payload: { from: 'half-open', to: 'closed' } }).catch(console.error);
            }
            
            return { data: res, path: attempt === 0 ? 'llm' : 'llm_retry' };
          } else {
            break;
          }
      } catch (error) {
        attempt++;
        if (attempt > config.RETRY_COUNT) {
          this.circuitBreaker.failures++;
          if (this.circuitBreaker.failures >= config.CIRCUIT_BREAKER_THRESHOLD && this.circuitBreaker.state !== 'open') {
            this.circuitBreaker.state = 'open';
            this.circuitBreaker.openUntil = Date.now() + config.CIRCUIT_BREAKER_COOLDOWN_MS;
            EventLog.create({ event: 'circuit.state_changed', payload: { from: 'closed/half-open', to: 'open' } }).catch(console.error);
          }
          console.warn(`[adminAgent] LLM failed after ${config.RETRY_COUNT} retries. Fallback.`);
          break;
        }
          console.warn(`[adminAgent] LLM error: ${error.message}. Retrying ${attempt}/${config.RETRY_COUNT}...`);
          await new Promise(resolve => setTimeout(resolve, config.BASE_BACKOFF_MS * Math.pow(2, attempt - 1)));
        }
      }
      return { data: null, path: 'fallback' };
    });
  }

  computePriorityScore(urgency, signals) {
    let score = config.PRIORITY_WEIGHTS.urgency[urgency] || 0;
    if (signals.injuries_mentioned) score += config.PRIORITY_WEIGHTS.signals.injuries_mentioned;
    if (signals.trapped_or_immobile) score += config.PRIORITY_WEIGHTS.signals.trapped_or_immobile;
    if (signals.vulnerable_persons) score += config.PRIORITY_WEIGHTS.signals.vulnerable_persons;
    if (signals.structural_damage) score += config.PRIORITY_WEIGHTS.signals.structural_damage;
    return score;
  }

  async handleCaseCreated(case_id, payload, qDepth) {
    let bypassLLM = false;
    if (qDepth > config.QUEUE_GOVERNOR_THRESHOLD) {
      bypassLLM = true;
      if (!this._governorActive) {
        this._governorActive = true;
        EventLog.create({ event: 'governor.activated', payload: { qDepth, threshold: config.QUEUE_GOVERNOR_THRESHOLD } }).catch(console.error);
      }
    } else if (this._governorActive && qDepth < config.QUEUE_GOVERNOR_THRESHOLD / 2) {
      this._governorActive = false;
      EventLog.create({ event: 'governor.deactivated', payload: { qDepth } }).catch(console.error);
    }

    const cacheKey = payload.description ? payload.description.trim().toLowerCase() : null;
    let cachedResult = null;
    if (cacheKey && this.llmCache.has(cacheKey)) {
       const entry = this.llmCache.get(cacheKey);
       if (Date.now() - entry.time < 5 * 60 * 1000) {
          cachedResult = entry;
       } else {
          this.llmCache.delete(cacheKey);
       }
    }

    let extractedSignals, extractionPath;

    if (cachedResult) {
      extractedSignals = cachedResult.extractedSignals;
      extractionPath = 'cache';
    } else {
      // Stage 1: Extraction
      const extractionPrompt = `Extract signals from the disaster complaint.
Description: "${payload.description}"
Respond ONLY with a JSON object: { "injuries_mentioned": bool, "trapped_or_immobile": bool, "structural_damage": bool, "vulnerable_persons": bool, "resource_type_guess": string[], "severity_keywords": string[] }`;
      
      let res = bypassLLM ? { data: null, path: 'governor_fallback' } : await this.callLLMWithRetry(extractionPrompt);
      extractedSignals = res.data ? JSON.parse(res.data) : null;
      extractionPath = res.path;

      if (extractionPath.includes('fallback') || !extractedSignals) {
        const desc = (payload.description || '').toLowerCase();
        extractedSignals = {
          injuries_mentioned: desc.includes('bleed') || desc.includes('injur') || desc.includes('heart') || desc.includes('breath'),
          trapped_or_immobile: desc.includes('trapped') || desc.includes('drown') || desc.includes('fire'),
          structural_damage: desc.includes('house') || desc.includes('homeless') || desc.includes('shelter') || desc.includes('fire'),
          vulnerable_persons: desc.includes('child') || desc.includes('elderly') || desc.includes('baby'),
          resource_type_guess: [],
          severity_keywords: []
        };
        if (extractedSignals.injuries_mentioned) extractedSignals.resource_type_guess.push('medical');
        if (extractedSignals.structural_damage) extractedSignals.resource_type_guess.push('shelter');
        if (extractedSignals.trapped_or_immobile) extractedSignals.resource_type_guess.push('rescue');
      }
    }

    // Clustering logic
    let incident_id = null;
    const recentCases = await Case.find({
      sector_id: payload.sector_id,
      status: { $in: ['intake', 'routed', 'assigned', 'escalated', 'pending'] },
      created_at: { $gt: new Date(Date.now() - config.CLUSTER_TIME_WINDOW_MS) }
    });

    let targetIncident = null;
    for (const c of recentCases) {
      if (c.case_id === case_id) continue;
      const comp = await Complaint.findOne({ case_id: c.case_id }).sort({ created_at: -1 });
      if (comp && comp.location) {
        const dist = getDistance(payload.location.lat, payload.location.lng, comp.location.lat, comp.location.lng);
        if (dist <= config.CLUSTER_RADIUS_KM) {
          if (c.incident_id) {
            targetIncident = await Incident.findOne({ incident_id: c.incident_id });
          }
          if (!targetIncident) {
            const newIncidentId = crypto.randomUUID();
            targetIncident = await Incident.create({
              incident_id: newIncidentId,
              sector_id: payload.sector_id,
              case_ids: [c.case_id]
            });
            await Case.updateOne({ case_id: c.case_id }, { incident_id: newIncidentId });
          }
          break;
        }
      }
    }

    const priority_score = this.computePriorityScore(payload.urgency, extractedSignals);

    if (targetIncident) {
      incident_id = targetIncident.incident_id;
      if (!targetIncident.case_ids.includes(case_id)) {
        targetIncident.case_ids.push(case_id);
      }
      
      const allCases = await Case.find({ case_id: { $in: targetIncident.case_ids } });
      let totalPriority = priority_score;
      for (const c of allCases) {
        if (c.case_id !== case_id) totalPriority += c.priority_score;
      }

      let newSeverity = 'minor';
      if (totalPriority >= 200) newSeverity = 'mass_casualty';
      else if (totalPriority >= 100) newSeverity = 'major';
      else if (totalPriority >= 50) newSeverity = 'moderate';

      if (targetIncident.severity !== newSeverity) {
        const oldSeverity = targetIncident.severity;
        targetIncident.severity = newSeverity;
        
        await EventLog.create({
          case_id: incident_id, // Hack to store incident logs
          event: 'incident.severity_changed',
          payload: { incident_id, oldSeverity, newSeverity, totalPriority }
        });

        if (newSeverity === 'major' || newSeverity === 'mass_casualty') {
          agentBus.emitEvent('incident.severity_raised', null, { incident_id, severity: newSeverity });
        }
      }
      
      await targetIncident.save();
    }

    await Case.updateOne({ case_id }, { priority_score, incident_id, extracted_signals: extractedSignals, prompt_version: config.PROMPT_VERSION });

    // Stage 2: Classification
    let classification, classificationPath;
    
    if (cachedResult) {
      classification = cachedResult.classification;
      classificationPath = 'cache';
    } else {
      const classificationPrompt = `Classify this disaster complaint based on these signals.
Signals: ${JSON.stringify(extractedSignals)}
Description: "${payload.description}"
Urgency: "${payload.urgency}"
Respond ONLY with a JSON object: { "category": "medical" | "shelter" | "rescue" | "mixed" | "unknown", "confidence": <float 0-1>, "reasoning": "<string>" }`;

      let res = bypassLLM ? { data: null, path: 'governor_fallback' } : await this.callLLMWithRetry(classificationPrompt);
      classification = res.data ? JSON.parse(res.data) : null;
      classificationPath = res.path;

      if (classificationPath.includes('fallback') || !classification) {
        let category = 'unknown';
        if (extractedSignals.injuries_mentioned) category = 'medical';
        else if (extractedSignals.structural_damage) category = 'shelter';
        else if (extractedSignals.trapped_or_immobile) category = 'rescue';
        
        classification = {
          category,
          confidence: category === 'unknown' ? 0 : 0.8,
          reasoning: 'Fallback keyword classification based on signals'
        };
      }
      
      // Save to cache
      if (cacheKey && (extractionPath.includes('llm') || classificationPath.includes('llm'))) {
        this.llmCache.set(cacheKey, { time: Date.now(), extractedSignals, classification });
        if (this.llmCache.size > 1000) {
          const firstKey = this.llmCache.keys().next().value;
          this.llmCache.delete(firstKey);
        }
      }
    }

    const finalPath = classificationPath === 'fallback' ? 'fallback' : classificationPath;
    
    // Log classification path
    await EventLog.create({
      case_id,
      event: 'case.classification_path',
      payload: { path: finalPath, extractedSignals, classification }
    });

    const { confidence } = classification;
    let { category, reasoning } = classification;

    if ((category === 'mixed' || category === 'unknown') && confidence >= config.AUTO_RESOLVE_THRESHOLD) {
      if (extractedSignals.injuries_mentioned && !extractedSignals.structural_damage) {
        category = 'medical';
        reasoning = '[Auto-Resolved from ' + classification.category + '] ' + reasoning;
        await EventLog.create({ event: 'case.auto_resolved', case_id, payload: { category }});
      } else if (extractedSignals.structural_damage && !extractedSignals.injuries_mentioned) {
        category = 'shelter';
        reasoning = '[Auto-Resolved from ' + classification.category + '] ' + reasoning;
        await EventLog.create({ event: 'case.auto_resolved', case_id, payload: { category }});
      }
    }

    await Case.updateOne({ case_id }, { category });

    const thresholdDoc = await ClassificationThreshold.findOne({ category });
    const threshold = thresholdDoc ? thresholdDoc.threshold : config.CONFIDENCE_THRESHOLD;

    if (confidence >= threshold && (category === 'medical' || category === 'shelter')) {
      const target = category === 'medical' ? 'hospital' : 'ngo';
      this.initiateBidding(case_id, payload, target, priority_score, qDepth || 0);
    } else if (category === 'rescue') {
      agentBus.emitEvent('rescue.requested', case_id, { location: payload.location, description: payload.description, priority_score });
    } else {
      let reason_taxonomy = 'unknown_category';
      if (confidence < threshold) reason_taxonomy = 'low_confidence';
      if (category === 'mixed') reason_taxonomy = 'mixed_category';
      
      const dbCase = await Case.findOne({ case_id });
      if (dbCase && dbCase.retries_count < config.MAX_AUTO_RETRIES) {
        await Case.updateOne({ case_id }, { $inc: { retries_count: 1 } });
        await EventLog.create({ event: 'case.auto_retry', case_id, payload: { reason: reason_taxonomy, attempt: dbCase.retries_count + 1 }});
        setTimeout(() => agentBus.emitEvent('case.created', case_id, payload), config.BASE_BACKOFF_MS);
        return;
      }
      
      let incidentContext = '';
      if (targetIncident) {
        incidentContext = ` (Part of incident ${targetIncident.incident_id} with ${targetIncident.case_ids.length} cases)`;
      }

      let plain_summary = `Escalated due to ${reason_taxonomy.replace('_', ' ')}. Classification: ${category} (confidence: ${confidence}).`;
      
      const prompt = `Generate a 1-2 sentence plain-language summary for a human operator explaining why this case was escalated.
Reason: ${reason_taxonomy}
Category guess: ${category}
Confidence: ${confidence}
Details: ${reasoning}
Keep it short, clear, and actionable.`;

      const llmRes = await this.callLLMWithRetry(prompt);
      if (llmRes.path !== 'fallback' && llmRes.data) {
         plain_summary = llmRes.data.trim();
      }

      this.stats.escalatedCount = (this.stats.escalatedCount || 0) + 1;
      await Escalation.create({
        case_id,
        incident_id: targetIncident ? targetIncident.incident_id : undefined,
        reason_taxonomy,
        reason: `Confidence: ${confidence}. Category: ${category}. Reasoning: ${reasoning}${incidentContext}`,
        original_category_guess: category,
        prompt_version: config.PROMPT_VERSION,
        plain_summary
      });
      await Case.updateOne({ case_id }, { status: 'escalated' });
      agentBus.emitEvent('escalation.raised', case_id, { reason: reason_taxonomy, classification, incident_id: targetIncident?.incident_id });
    }
  }

  async initiateBidding(case_id, payload, target, priority_score, qDepth = 0) {
    await Case.updateOne({ case_id }, { status: 'routed' });
    agentBus.emitEvent('case.routed', case_id, { ...payload, target, priority_score });
  }

  async finalizeBidding(case_id) {
    const { bids, target } = this.activeBids[case_id] || { bids: [] };
    delete this.activeBids[case_id];

    if (bids.length > 0) {
      bids.sort((a, b) => b.fit_score - a.fit_score);
      const winner = bids[0];

      await EventLog.create({
        case_id,
        event: 'case.bid_selection',
        payload: { bids_received: bids.length, winner_fit: winner.fit_score, runner_up_fit: bids[1]?.fit_score, winner_id: winner.facility_id }
      });

      agentBus.emitEvent('assignment.confirmed', case_id, {
        facility_id: winner.facility_id,
        facility_type: winner.facility_type,
        facility_name: winner.facility_name
      });
    } else {
      const dbCase = await Case.findOne({ case_id });
      if (dbCase && dbCase.retries_count < config.MAX_AUTO_RETRIES) {
        await Case.updateOne({ case_id }, { $inc: { retries_count: 1 } });
        await EventLog.create({ event: 'case.auto_retry', case_id, payload: { reason: 'assignment_failed', target, attempt: dbCase.retries_count + 1 }});
        const comp = await Complaint.findOne({ case_id }).sort({ created_at: -1 });
        this.initiateBidding(case_id, { urgency: dbCase.urgency, location: comp.location }, target, dbCase.priority_score, 0);
        return;
      }

      await Escalation.create({
        case_id,
        reason_taxonomy: 'assignment_failed',
        reason: `Assignment failed for target: ${target} (No bids received within window)`
      });
      await Case.updateOne({ case_id }, { status: 'escalated' });
      agentBus.emitEvent('escalation.raised', case_id, { reason: 'assignment_failed', payload: { target } });
    }
  }

  async resolveEscalation(escalation_id, decision, notes) {
    const escalation = await Escalation.findById(escalation_id);
    if (!escalation || escalation.resolved) return false;

    escalation.resolved = true;
    escalation.decision = decision;
    escalation.resolved_by = 'operator';
    escalation.resolved_at = new Date();

    const case_id = escalation.case_id;

    if (decision === 'retry') {
      await escalation.save();
      const comp = await Complaint.findOne({ case_id }).sort({ created_at: -1 });
      await Case.updateOne({ case_id }, { status: 'intake', category: 'pending' });
      // Re-trigger handleCaseCreated
      this.handleCaseCreated(case_id, {
        description: comp.description,
        urgency: comp.urgency,
        location: comp.location
      });
      return true;
    }

    if (decision === 'hospital' || decision === 'ngo') {
      const targetCategory = decision === 'hospital' ? 'medical' : 'shelter';
      escalation.was_llm_correct = (escalation.original_category_guess === targetCategory);
    }

    await escalation.save();

    if (decision === 'hospital' || decision === 'ngo') {
      const c = await Case.findOne({ case_id });
      const comp = await Complaint.findOne({ case_id }).sort({ created_at: -1 });
      
      await Case.updateOne({ case_id }, { status: 'routed' });
      this.initiateBidding(case_id, { urgency: c.urgency, location: comp.location }, decision, c.priority_score);
    } else if (decision === 'reject') {
      await Case.updateOne({ case_id }, { status: 'rejected', resolved_at: new Date() });
      agentBus.emitEvent('case.resolved', case_id, { reason: 'rejected_by_operator', notes });
    }
    return true;
  }

  async runRecalibration(triggeredBy) {
    const N = 50;
    const categories = ['medical', 'shelter', 'rescue', 'unknown', 'mixed'];
    const results = {};

    for (const cat of categories) {
      const escalations = await Escalation.find({ 
        resolved: true, 
        original_category_guess: cat, 
        was_llm_correct: { $exists: true } 
      }).sort({ raised_at: -1 }).limit(N);

      if (escalations.length >= 10) {
        const correct = escalations.filter(e => e.was_llm_correct).length;
        const accuracy = correct / escalations.length;
        
        let newThreshold = config.CONFIDENCE_THRESHOLD;
        if (accuracy < 0.7) newThreshold = Math.min(1.0, config.CONFIDENCE_THRESHOLD + 0.1); 
        else if (accuracy > 0.9) newThreshold = Math.max(0.0, config.CONFIDENCE_THRESHOLD - 0.1);
        
        const ClassificationThreshold = require('../models/ClassificationThreshold');
        const existing = await ClassificationThreshold.findOne({ category: cat });
        const oldVal = existing ? existing.threshold : config.CONFIDENCE_THRESHOLD;

        if (oldVal !== newThreshold) {
          await ClassificationThreshold.updateOne(
            { category: cat }, 
            { threshold: newThreshold, sample_size: escalations.length, last_updated: new Date() },
            { upsert: true }
          );

          await EventLog.create({
            event: 'threshold.recalibrated',
            payload: { category: cat, oldThreshold: oldVal, newThreshold, accuracy, sample_size: escalations.length, triggered_by: triggeredBy }
          });
        }
        results[cat] = { newThreshold, accuracy, sample_size: escalations.length };
      } else {
        results[cat] = { message: 'Insufficient samples', sample_size: escalations.length };
      }
    }
    return results;
  }

  async addFeedback(case_id, rating, note) {
    const Case = require('../models/Case');
    await Case.updateOne({ case_id }, { operator_feedback: { rating, note } });
    return true;
  }

  async undoEscalation(escalation_id) {
    const config = require('../config/adminAgentConfig');
    const Escalation = require('../models/Escalation');
    const Case = require('../models/Case');
    const escalation = await Escalation.findById(escalation_id);
    if (!escalation || !escalation.resolved) return false;
    
    if (Date.now() - escalation.resolved_at.getTime() > config.UNDO_WINDOW_MS) {
      throw new Error('Undo window expired');
    }

    escalation.resolved = false;
    escalation.decision = undefined;
    escalation.resolved_at = undefined;
    escalation.was_llm_correct = undefined;
    await escalation.save();

    await Case.updateOne({ case_id: escalation.case_id }, { status: 'escalated' });
    return true;
  }

  async resolveIncidentAll(incident_id, decision, notes) {
    const Incident = require('../models/Incident');
    const Escalation = require('../models/Escalation');
    const incident = await Incident.findOne({ incident_id });
    if (!incident) throw new Error('Incident not found');
    
    const escalations = await Escalation.find({ 
      case_id: { $in: incident.case_ids }, 
      resolved: false 
    });

    let count = 0;
    for (const esc of escalations) {
      const success = await this.resolveEscalation(esc._id, decision, notes);
      if (success) count++;
    }
    return count;
  }

  async parseQuery(query) {
    let filterParams = {};
    const q = query.toLowerCase();
    if (q.includes('critical')) filterParams.urgency = 'critical';
    else if (q.includes('high')) filterParams.urgency = 'high';
    else if (q.includes('medium')) filterParams.urgency = 'medium';
    else if (q.includes('low')) filterParams.urgency = 'low';
    
    const sectorMatch = q.match(/sector\s*(\d+)/);
    if (sectorMatch) filterParams.sector_id = sectorMatch[1];
    
    if (q.includes('intake')) filterParams.status = 'intake';
    else if (q.includes('escalated')) filterParams.status = 'escalated';
    else if (q.includes('resolved')) filterParams.status = 'resolved';
    
    const llmPrompt = `Extract API filter parameters from this natural language query: "${query}".
Possible parameters: urgency (low, medium, high, critical), status (intake, routed, assigned, resolved, escalated, rejected), sector_id (number as string).
Return only a JSON object, e.g. {"urgency":"critical","sector_id":"4"}. If no filters match, return {}.`;
    
    const llmRes = await this.callLLMWithRetry(llmPrompt);
    if (llmRes.path !== 'fallback' && llmRes.data) {
      try {
        const parsed = JSON.parse(llmRes.data.replace(/```json/g, '').replace(/```/g, '').trim());
        if (typeof parsed === 'object') {
          filterParams = { ...filterParams, ...parsed };
        }
      } catch (e) {}
    }
    return filterParams;
  }
}

module.exports = new AdminAgent();
