const Ngo = require('../models/Ngo');
const Case = require('../models/Case');
const agentBus = require('../services/agentBus');
const { getDistance } = require('../services/geo');
const ngoLLMClient = require('../services/ngoLLMClient');

class NgoAgent {
  constructor() {
    // In-memory set to prevent immediate concurrent duplicate processing for the same case_id
    this.inFlightCases = new Set();
    this.setupListeners();
  }

  setupListeners() {
    agentBus.on('case.routed', async ({ case_id, payload }) => {
      if (payload && payload.target === 'ngo') {
        await this.handleRouting(case_id, payload);
      }
    });
  }

  /**
   * Determine the specific resource type and quantity needed for this case
   */
  determineResourceNeed(payload) {
    let resourceType = 'shelter_capacity';
    let quantity = 1;

    // 1. Explicit resource_type in payload
    if (payload.resource_type) {
      const explicit = payload.resource_type.toLowerCase();
      if (explicit.includes('food')) {
        resourceType = 'food_units';
      } else if (explicit.includes('supply') || explicit.includes('supplies') || explicit.includes('kit')) {
        resourceType = 'supply_units';
      } else if (explicit.includes('shelter')) {
        resourceType = 'shelter_capacity';
      }
    } else if (payload.category) {
      // 2. Infer from category or description
      const cat = (payload.category || '').toLowerCase();
      const desc = (payload.description || '').toLowerCase();

      if (desc.includes('food') || desc.includes('eat') || desc.includes('starv') || desc.includes('ration') || desc.includes('hungry') || desc.includes('water')) {
        resourceType = 'food_units';
      } else if (desc.includes('blanket') || desc.includes('supply') || desc.includes('supplies') || desc.includes('cloth') || desc.includes('kit') || desc.includes('tarp')) {
        resourceType = 'supply_units';
      } else if (cat === 'shelter' || desc.includes('shelter') || desc.includes('house') || desc.includes('homeless') || desc.includes('cold') || desc.includes('roof')) {
        resourceType = 'shelter_capacity';
      }
    }

    // 3. Determine quantity
    if (typeof payload.quantity === 'number' && payload.quantity > 0) {
      quantity = Math.floor(payload.quantity);
    } else if (payload.urgency === 'critical' && resourceType !== 'shelter_capacity') {
      quantity = 2; // Critical non-shelter relief may allocate 2 units
    }

    return { resourceType, quantity };
  }

  /**
   * Deterministic and explainable ranking algorithm
   * Evaluates distance, workload, available capacity, active status, reliability, and data freshness
   */
  rankCandidates(candidates, location, resourceType, quantityNeeded) {
    const scored = candidates.map(ngo => {
      const distKm = getDistance(
        location.lat,
        location.lng,
        ngo.location.lat,
        ngo.location.lng
      );
      const workload = ngo.workload || 0;
      const capacity = ngo[resourceType] || 0;

      // Reliability calculation (0.0 to 1.0)
      const totalAllocs = (ngo.successful_allocations || 0) + (ngo.failed_allocations || 0);
      const reliabilityScore = totalAllocs === 0 ? 1.0 : (ngo.successful_allocations || 0) / totalAllocs;

      // Freshness check (penalty if last updated > 24 hours ago)
      const lastUpdate = ngo.last_availability_update ? new Date(ngo.last_availability_update).getTime() : 0;
      const ageHours = (Date.now() - lastUpdate) / (1000 * 60 * 60);
      const isStale = ageHours > 24;
      const stalePenalty = isStale ? 2.5 : 0; // Stale data adds 2.5 km equivalent penalty

      // Deterministic ranking formula (lower rankScore = better match):
      // - Distance: 1.0x weight (km)
      // - Workload: 0.25x weight (load balancing)
      // - Capacity reserve: -0.001x (favors deeper reserves)
      // - Reliability: -1.5x * reliabilityScore (favors proven reliable NGOs)
      // - Stale penalty: +2.5x if unverified/stale (>24h)
      const rankScore = (distKm * 1.0) + (workload * 0.25) - (capacity * 0.001) - (reliabilityScore * 1.5) + stalePenalty;

      return {
        ngo,
        distanceKm: distKm,
        workload,
        capacity,
        reliabilityScore: parseFloat(reliabilityScore.toFixed(2)),
        isStale,
        rankScore,
        explanation: `Distance: ${distKm.toFixed(2)}km | Workload: ${workload} | ${resourceType}: ${capacity} avail | Reliability: ${(reliabilityScore * 100).toFixed(0)}% | Freshness: ${isStale ? 'STALE (>24h)' : 'FRESH'}`
      };
    });

    // Deterministic sort: lowest rankScore first, tie-break by Mongo _id string
    scored.sort((a, b) => {
      if (Math.abs(a.rankScore - b.rankScore) > 0.0001) {
        return a.rankScore - b.rankScore;
      }
      return a.ngo._id.toString().localeCompare(b.ngo._id.toString());
    });

    return scored;
  }

  /**
   * Main routing handler for NGO cases
   */
  async handleRouting(case_id, payload) {
    console.log(`[ngoAgent] Received routing request for case ${case_id}`);

    // --- 1. Idempotency & Duplicate Protection ---
    if (!case_id) {
      console.warn(`[ngoAgent] Missing case_id in routing payload.`);
      return;
    }

    if (this.inFlightCases.has(case_id)) {
      console.warn(`[ngoAgent] Idempotency: Case ${case_id} is already being processed concurrently. Skipping.`);
      return;
    }

    this.inFlightCases.add(case_id);

    try {
      // Check database to see if case was already assigned
      const existingCase = await Case.findOne({ case_id });
      if (existingCase && existingCase.assigned_facility_id && (existingCase.status === 'assigned' || existingCase.status === 'resolved')) {
        console.log(`[ngoAgent] Idempotency: Case ${case_id} already has assigned facility (${existingCase.assigned_facility_id}). Skipping duplicate deduction.`);
        return;
      }

      // --- 2. Validate Incident Location ---
      const location = payload.location || (existingCase && existingCase.location);
      if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        console.warn(`[ngoAgent] Case ${case_id} has invalid/missing coordinates (${JSON.stringify(location)}).`);
        await agentBus.emitEvent('assignment.failed', case_id, {
          case_id,
          target: 'ngo',
          reason: 'Invalid or missing incident coordinates for distance matching'
        });
        return;
      }

      // --- 3. Determine Resource Type and Quantity ---
      const { resourceType, quantity } = this.determineResourceNeed(payload);
      console.log(`[ngoAgent] Case ${case_id} requires ${quantity} unit(s) of [${resourceType}]`);

      // --- 4. Query Eligible NGO Candidates ---
      const candidates = await Ngo.find({
        is_active: true,
        [resourceType]: { $gte: quantity }
      });

      if (candidates.length === 0) {
        const anyNgos = await Ngo.countDocuments({ is_active: true });
        const reason = anyNgos === 0
          ? 'No active NGO facilities registered in the system'
          : `Insufficient capacity: No active NGO has at least ${quantity} unit(s) of ${resourceType} available`;

        console.warn(`[ngoAgent] Assignment failed for case ${case_id}: ${reason}`);
        await agentBus.emitEvent('assignment.failed', case_id, {
          case_id,
          target: 'ngo',
          resource_type: resourceType,
          requested_quantity: quantity,
          reason
        });
        return;
      }

      // --- 5. Rank Candidates Deterministically ---
      const rankedCandidates = this.rankCandidates(candidates, location, resourceType, quantity);
      console.log(`[ngoAgent] Found ${rankedCandidates.length} eligible NGO candidate(s) for case ${case_id}. Top deterministic candidate: ${rankedCandidates[0].ngo.name}`);

      // --- 5b. LLM Hybrid Decision Engine ---
      const caseDetails = {
        urgency: payload.urgency || (existingCase && existingCase.urgency),
        category: payload.category || (existingCase && existingCase.category),
        description: payload.description || (existingCase && existingCase.description)
      };
      
      const llmRecommendation = await ngoLLMClient.evaluateNgoCandidates(caseDetails, rankedCandidates.slice(0, 5));
      if (llmRecommendation && llmRecommendation.recommended_facility_id) {
        const recommendedId = llmRecommendation.recommended_facility_id.toString();
        const foundIndex = rankedCandidates.findIndex(c => c.ngo._id.toString() === recommendedId);
        if (foundIndex !== -1) {
          console.log(`[ngoAgent] LLM Recommended facility ${recommendedId}. Shifting to top priority.`);
          const recommendedCandidate = rankedCandidates.splice(foundIndex, 1)[0];
          recommendedCandidate.explanation = `[LLM Selected: ${llmRecommendation.reasoning}] | ${recommendedCandidate.explanation}`;
          rankedCandidates.unshift(recommendedCandidate);
        } else {
          console.warn(`[ngoAgent] LLM recommended an invalid or unlisted facility (${recommendedId}). Ignoring.`);
        }
      }

      // --- 6. Concurrency-Safe Atomic Allocation ---
      let allocatedNgo = null;
      let winningCandidateInfo = null;

      for (const candidateInfo of rankedCandidates) {
        const candidateId = candidateInfo.ngo._id;

        // Atomic decrement with condition [resourceType] >= quantity to prevent negative inventory
        const updatedNgo = await Ngo.findOneAndUpdate(
          {
            _id: candidateId,
            is_active: true,
            [resourceType]: { $gte: quantity }
          },
          {
            $inc: {
              [resourceType]: -quantity,
              workload: 1,
              successful_allocations: 1
            },
            $set: {
              last_availability_update: new Date()
            },
            $push: {
              allocation_history: {
                timestamp: new Date(),
                resource_type: resourceType,
                quantity,
                case_id
              }
            }
          },
          {
            returnDocument: 'after'
          }
        );

        if (updatedNgo) {
          allocatedNgo = updatedNgo;
          winningCandidateInfo = candidateInfo;
          console.log(`[ngoAgent] Successfully allocated ${quantity} ${resourceType} from ${allocatedNgo.name} to case ${case_id}. Remaining: ${allocatedNgo[resourceType]}`);
          break;
        } else {
          console.warn(`[ngoAgent] Race condition: ${candidateInfo.ngo.name} capacity changed during allocation. Trying next alternative.`);
          await Ngo.updateOne({ _id: candidateId }, { $inc: { failed_allocations: 1 } });
        }
      }

      if (!allocatedNgo) {
        console.warn(`[ngoAgent] All candidates were depleted during concurrent allocation for case ${case_id}.`);
        await agentBus.emitEvent('assignment.failed', case_id, {
          case_id,
          target: 'ngo',
          resource_type: resourceType,
          requested_quantity: quantity,
          reason: 'All candidate NGOs exhausted available capacity during concurrent allocation'
        });
        return;
      }

      // --- 7. Emit Success Events and Broadcasts ---
      // A. Emit availability update for live Resource Dashboard
      await agentBus.emitEvent('ngo.availability.updated', null, allocatedNgo.toObject ? allocatedNgo.toObject() : allocatedNgo);

      // B. Emit assignment confirmation for AdminAgent and Case resolution
      const confirmationPayload = {
        case_id,
        facility_id: allocatedNgo._id.toString(),
        facility_type: 'ngo',
        facility_name: allocatedNgo.name,
        resource_type: resourceType,
        quantity,
        distance_km: parseFloat(winningCandidateInfo.distanceKm.toFixed(2)),
        remaining_capacity: allocatedNgo[resourceType],
        workload: allocatedNgo.workload,
        ranking_explanation: winningCandidateInfo.explanation
      };

      console.log(`[ngoAgent] assignment.confirmed for case ${case_id} -> ${allocatedNgo.name} (${confirmationPayload.distance_km} km)`);
      await agentBus.emitEvent('assignment.confirmed', case_id, confirmationPayload);

    } catch (error) {
      console.error(`[ngoAgent] Unexpected error during case routing for ${case_id}:`, error);
      await agentBus.emitEvent('assignment.failed', case_id, {
        case_id,
        target: 'ngo',
        reason: `Internal agent error: ${error.message}`
      });
    } finally {
      this.inFlightCases.delete(case_id);
    }
  }
}

module.exports = new NgoAgent();
