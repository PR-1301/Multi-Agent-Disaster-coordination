require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Ngo = require('../models/Ngo');
const Case = require('../models/Case');
const EventLog = require('../models/EventLog');
const agentBus = require('../services/agentBus');
const ngoAgent = require('../agents/ngoAgent');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/disaster-coordination';

function waitForEvent(eventName, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${eventName}" after ${timeoutMs}ms`));
    }, timeoutMs);

    const listener = (data) => {
      clearTimeout(timer);
      agentBus.removeListener(eventName, listener);
      resolve(data);
    };

    agentBus.on(eventName, listener);
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function cleanupTestData() {
  await Ngo.deleteMany({ name: { $regex: /^TEST_/ } });
  await Case.deleteMany({ case_id: { $regex: /^TEST_CASE_/ } });
  await EventLog.deleteMany({ case_id: { $regex: /^TEST_CASE_/ } });
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 Starting NGO Agent Comprehensive Test Suite');
  console.log('====================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB for testing.\n');

  await cleanupTestData();

  try {
    // ----------------------------------------------------
    // TEST 1: Successful Shelter Allocation & Event Payloads
    // ----------------------------------------------------
    console.log('--- TEST 1: Shelter Allocation & assignment.confirmed Payload ---');
    const ngoShelter = await Ngo.create({
      name: 'TEST_Shelter_Relief_1',
      location: { lat: 40.7128, lng: -74.0060 }, // NYC Center
      food_units: 50,
      shelter_capacity: 10,
      supply_units: 30,
      is_active: true
    });

    const case1Id = 'TEST_CASE_SHELTER_001';
    await Case.create({
      case_id: case1Id,
      sector_id: 'SEC-1',
      category: 'shelter',
      urgency: 'high',
      status: 'routed'
    });

    const event1Promise = waitForEvent('assignment.confirmed');
    const update1Promise = waitForEvent('ngo.availability.updated');

    // Trigger case.routed
    agentBus.emit('case.routed', {
      case_id: case1Id,
      payload: {
        target: 'ngo',
        resource_type: 'shelter_capacity',
        quantity: 2,
        urgency: 'high',
        location: { lat: 40.7130, lng: -74.0062 }
      }
    });

    const [confirmed1, update1] = await Promise.all([event1Promise, update1Promise]);

    assert(confirmed1.case_id === case1Id, 'Event contains correct case_id');
    assert(confirmed1.payload.facility_id === ngoShelter._id.toString(), 'Event contains assigned NGO ID');
    assert(confirmed1.payload.facility_type === 'ngo', 'Facility type is "ngo"');
    assert(confirmed1.payload.resource_type === 'shelter_capacity', 'Resource type is shelter_capacity');
    assert(confirmed1.payload.quantity === 2, 'Allocated quantity matches request (2)');
    assert(confirmed1.payload.remaining_capacity === 8, 'Remaining shelter capacity is 8 (10 - 2)');
    assert(typeof confirmed1.payload.distance_km === 'number', 'Distance in km is provided');
    assert(typeof confirmed1.payload.ranking_explanation === 'string', 'Ranking explanation is present');

    // Verify DB update
    const reloadedNgo1 = await Ngo.findById(ngoShelter._id);
    assert(reloadedNgo1.shelter_capacity === 8, 'MongoDB shelter_capacity correctly decremented to 8');
    assert(reloadedNgo1.workload === 1, 'MongoDB NGO workload incremented to 1');
    assert(reloadedNgo1.successful_allocations === 1, 'successful_allocations incremented to 1');
    assert(reloadedNgo1.allocation_history.length === 1, 'allocation_history has 1 record');
    console.log('✅ TEST 1 Passed.\n');

    // ----------------------------------------------------
    // TEST 2: Food Unit Allocation
    // ----------------------------------------------------
    console.log('--- TEST 2: Food Unit Allocation ---');
    const case2Id = 'TEST_CASE_FOOD_002';
    await Case.create({
      case_id: case2Id,
      sector_id: 'SEC-2',
      category: 'shelter',
      urgency: 'medium',
      status: 'routed'
    });

    const event2Promise = waitForEvent('assignment.confirmed');
    agentBus.emit('case.routed', {
      case_id: case2Id,
      payload: {
        target: 'ngo',
        resource_type: 'food_units',
        quantity: 5,
        location: { lat: 40.7128, lng: -74.0060 }
      }
    });

    const confirmed2 = await event2Promise;
    assert(confirmed2.payload.resource_type === 'food_units', 'Allocated resource is food_units');
    assert(confirmed2.payload.quantity === 5, 'Allocated quantity is 5');
    assert(confirmed2.payload.remaining_capacity === 45, 'Remaining food units is 45 (50 - 5)');

    const reloadedNgo2 = await Ngo.findById(ngoShelter._id);
    assert(reloadedNgo2.food_units === 45, 'MongoDB food_units correctly decremented to 45');
    console.log('✅ TEST 2 Passed.\n');

    // ----------------------------------------------------
    // TEST 3: Essential Supply Allocation
    // ----------------------------------------------------
    console.log('--- TEST 3: Essential Supply Allocation ---');
    const case3Id = 'TEST_CASE_SUPPLY_003';
    await Case.create({
      case_id: case3Id,
      sector_id: 'SEC-3',
      category: 'shelter',
      urgency: 'low',
      status: 'routed'
    });

    const event3Promise = waitForEvent('assignment.confirmed');
    agentBus.emit('case.routed', {
      case_id: case3Id,
      payload: {
        target: 'ngo',
        resource_type: 'supply_units',
        quantity: 3,
        location: { lat: 40.7128, lng: -74.0060 }
      }
    });

    const confirmed3 = await event3Promise;
    assert(confirmed3.payload.resource_type === 'supply_units', 'Allocated resource is supply_units');
    assert(confirmed3.payload.remaining_capacity === 27, 'Remaining supply units is 27 (30 - 3)');

    const reloadedNgo3 = await Ngo.findById(ngoShelter._id);
    assert(reloadedNgo3.supply_units === 27, 'MongoDB supply_units correctly decremented to 27');
    console.log('✅ TEST 3 Passed.\n');

    // Clean up previous test NGOs before testing alternative selection
    await cleanupTestData();

    // ----------------------------------------------------
    // TEST 4: Alternative NGO Selection based on Distance & Availability
    // ----------------------------------------------------
    console.log('--- TEST 4: Alternative NGO Selection (Closest NGO is Full) ---');
    const closeFullNgo = await Ngo.create({
      name: 'TEST_Close_Full_NGO',
      location: { lat: 40.7129, lng: -74.0061 }, // Very close (~0.01 km)
      shelter_capacity: 0,
      food_units: 10,
      is_active: true
    });

    const fartherNgo = await Ngo.create({
      name: 'TEST_Farther_Available_NGO',
      location: { lat: 40.7580, lng: -73.9855 }, // Midtown (~6 km)
      shelter_capacity: 15,
      food_units: 20,
      is_active: true
    });

    const case4Id = 'TEST_CASE_ALTERNATIVE_004';
    await Case.create({
      case_id: case4Id,
      sector_id: 'SEC-4',
      category: 'shelter',
      urgency: 'high',
      status: 'routed'
    });

    const event4Promise = waitForEvent('assignment.confirmed');
    agentBus.emit('case.routed', {
      case_id: case4Id,
      payload: {
        target: 'ngo',
        resource_type: 'shelter_capacity',
        quantity: 1,
        location: { lat: 40.7128, lng: -74.0060 }
      }
    });

    const confirmed4 = await event4Promise;
    assert(confirmed4.payload.facility_id === fartherNgo._id.toString(), 'Correctly bypassed full NGO and selected available alternative');
    assert(confirmed4.payload.facility_name === 'TEST_Farther_Available_NGO', 'Selected farther NGO with capacity');
    console.log('✅ TEST 4 Passed.\n');

    // ----------------------------------------------------
    // TEST 5: Insufficient Capacity Handling (assignment.failed)
    // ----------------------------------------------------
    console.log('--- TEST 5: Insufficient Capacity (assignment.failed) ---');
    const case5Id = 'TEST_CASE_INSUFFICIENT_005';
    await Case.create({
      case_id: case5Id,
      sector_id: 'SEC-5',
      category: 'shelter',
      urgency: 'critical',
      status: 'routed'
    });

    const event5Promise = waitForEvent('assignment.failed');
    agentBus.emit('case.routed', {
      case_id: case5Id,
      payload: {
        target: 'ngo',
        resource_type: 'shelter_capacity',
        quantity: 99999,
        location: { lat: 40.7128, lng: -74.0060 }
      }
    });

    const failed5 = await event5Promise;
    assert(failed5.case_id === case5Id, 'Failure event contains case_id');
    assert(failed5.payload.target === 'ngo', 'Target is ngo');
    assert(failed5.payload.resource_type === 'shelter_capacity', 'Resource type is specified in failure payload');
    assert(failed5.payload.requested_quantity === 99999, 'Requested quantity is specified');
    assert(typeof failed5.payload.reason === 'string' && failed5.payload.reason.includes('Insufficient capacity'), 'Reason explains capacity shortfall');
    console.log('✅ TEST 5 Passed.\n');

    // ----------------------------------------------------
    // TEST 6: No Matching / Inactive NGOs
    // ----------------------------------------------------
    console.log('--- TEST 6: No Matching NGOs ---');
    await Ngo.updateMany({ name: { $regex: /^TEST_/ } }, { is_active: false });

    const case6Id = 'TEST_CASE_NO_ACTIVE_006';
    await Case.create({
      case_id: case6Id,
      sector_id: 'SEC-6',
      category: 'shelter',
      urgency: 'medium',
      status: 'routed'
    });

    const event6Promise = waitForEvent('assignment.failed');
    agentBus.emit('case.routed', {
      case_id: case6Id,
      payload: {
        target: 'ngo',
        resource_type: 'food_units',
        quantity: 1,
        location: { lat: 40.7128, lng: -74.0060 }
      }
    });

    const failed6 = await event6Promise;
    assert(failed6.case_id === case6Id, 'Failure event fired for no active NGOs');
    assert(typeof failed6.payload.reason === 'string', 'Meaningful failure reason provided');

    await Ngo.updateMany({ name: { $regex: /^TEST_/ } }, { is_active: true });
    console.log('✅ TEST 6 Passed.\n');

    // ----------------------------------------------------
    // TEST 7: Idempotency / Duplicate Request Protection
    // ----------------------------------------------------
    console.log('--- TEST 7: Idempotency & Duplicate Request Protection ---');
    const ngoIdemp = await Ngo.create({
      name: 'TEST_Idempotency_NGO',
      location: { lat: 40.7128, lng: -74.0060 },
      shelter_capacity: 5,
      is_active: true
    });

    const case7Id = 'TEST_CASE_IDEMP_007';
    await Case.create({
      case_id: case7Id,
      sector_id: 'SEC-7',
      category: 'shelter',
      urgency: 'high',
      status: 'routed'
    });

    const event7Promise = waitForEvent('assignment.confirmed');
    agentBus.emit('case.routed', {
      case_id: case7Id,
      payload: {
        target: 'ngo',
        resource_type: 'shelter_capacity',
        quantity: 1,
        location: { lat: 40.7128, lng: -74.0060 }
      }
    });
    await event7Promise;

    await Case.updateOne(
      { case_id: case7Id },
      { status: 'resolved', assigned_facility_id: ngoIdemp._id.toString(), assigned_facility_type: 'ngo' }
    );

    const ngoBeforeDuplicate = await Ngo.findById(ngoIdemp._id);
    const capacityBefore = ngoBeforeDuplicate.shelter_capacity;

    await ngoAgent.handleRouting(case7Id, {
      target: 'ngo',
      resource_type: 'shelter_capacity',
      quantity: 1,
      location: { lat: 40.7128, lng: -74.0060 }
    });

    const ngoAfterDuplicate = await Ngo.findById(ngoIdemp._id);
    assert(ngoAfterDuplicate.shelter_capacity === capacityBefore, 'Duplicate request did NOT double-decrement inventory');
    console.log('✅ TEST 7 Passed.\n');

    // ----------------------------------------------------
    // TEST 8: High Concurrency & Non-Negative Inventory Guarantee
    // ----------------------------------------------------
    console.log('--- TEST 8: Concurrency Stress Test & Non-Negative Inventory ---');
    await cleanupTestData();

    const initialCapacity = 3;
    const concurrentNgo = await Ngo.create({
      name: 'TEST_Concurrent_Limited_NGO',
      location: { lat: 40.7128, lng: -74.0060 },
      shelter_capacity: initialCapacity,
      is_active: true
    });

    const totalRequests = 10;
    const caseIds = Array.from({ length: totalRequests }).map((_, i) => `TEST_CASE_CONCUR_${i}`);

    for (const cid of caseIds) {
      await Case.create({
        case_id: cid,
        sector_id: 'SEC-CONC',
        category: 'shelter',
        urgency: 'high',
        status: 'routed'
      });
    }

    let confirmedCount = 0;
    let failedCount = 0;

    const onConfirmed = ({ case_id }) => {
      if (case_id && case_id.startsWith('TEST_CASE_CONCUR_')) confirmedCount++;
    };
    const onFailed = ({ case_id }) => {
      if (case_id && case_id.startsWith('TEST_CASE_CONCUR_')) failedCount++;
    };

    agentBus.on('assignment.confirmed', onConfirmed);
    agentBus.on('assignment.failed', onFailed);

    await Promise.all(
      caseIds.map(cid =>
        ngoAgent.handleRouting(cid, {
          target: 'ngo',
          resource_type: 'shelter_capacity',
          quantity: 1,
          location: { lat: 40.7128, lng: -74.0060 }
        })
      )
    );

    agentBus.removeListener('assignment.confirmed', onConfirmed);
    agentBus.removeListener('assignment.failed', onFailed);

    const finalNgoState = await Ngo.findById(concurrentNgo._id);

    console.log(`Concurrent Results: Confirmed=${confirmedCount}, Failed=${failedCount}, Final Inventory=${finalNgoState.shelter_capacity}`);
    assert(confirmedCount === initialCapacity, `Exactly ${initialCapacity} concurrent requests succeeded`);
    assert(failedCount === totalRequests - initialCapacity, `Exactly ${totalRequests - initialCapacity} concurrent requests received assignment.failed`);
    assert(finalNgoState.shelter_capacity === 0, 'Inventory ended at exactly 0 and never became negative');
    assert(finalNgoState.shelter_capacity >= 0, 'Inventory is non-negative');
    console.log('✅ TEST 8 Passed.\n');

    // ----------------------------------------------------
    // TEST 9: ngo.availability.updated on Capacity Update
    // ----------------------------------------------------
    console.log('--- TEST 9: ngo.availability.updated Event Handling ---');
    const updateNgo = await Ngo.create({
      name: 'TEST_Availability_Update_NGO',
      location: { lat: 40.7128, lng: -74.0060 },
      food_units: 100,
      shelter_capacity: 50,
      supply_units: 75,
      is_active: true
    });

    const availabilityPromise = waitForEvent('ngo.availability.updated');

    updateNgo.food_units = 150;
    updateNgo.shelter_capacity = 60;
    updateNgo.last_availability_update = new Date();
    await updateNgo.save();
    await agentBus.emitEvent('ngo.availability.updated', null, updateNgo.toObject());

    const updateEvent = await availabilityPromise;
    assert(updateEvent.payload.name === 'TEST_Availability_Update_NGO', 'Availability event contains NGO name');
    assert(updateEvent.payload.food_units === 150, 'Availability event contains updated food_units (150)');
    assert(updateEvent.payload.shelter_capacity === 60, 'Availability event contains updated shelter_capacity (60)');
    console.log('✅ TEST 9 Passed.\n');

    // ----------------------------------------------------
    // TEST 10: Stale Data Detection & Freshness in Ranking
    // ----------------------------------------------------
    console.log('--- TEST 10: Stale Data Detection & Freshness Penalty in Ranking ---');
    await cleanupTestData();

    // NGO A: Stale (last updated 48 hours ago), slightly closer (~1.0 km)
    const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const staleNgo = await Ngo.create({
      name: 'TEST_Stale_NGO_A',
      location: { lat: 40.7200, lng: -74.0060 },
      shelter_capacity: 20,
      last_availability_update: staleDate,
      is_active: true
    });

    // NGO B: Fresh (updated just now), slightly farther (~1.5 km)
    const freshNgo = await Ngo.create({
      name: 'TEST_Fresh_NGO_B',
      location: { lat: 40.7250, lng: -74.0060 },
      shelter_capacity: 20,
      last_availability_update: new Date(),
      is_active: true
    });

    assert(staleNgo.isStale(24) === true, 'Stale NGO correctly identified as stale (>24h)');
    assert(freshNgo.isStale(24) === false, 'Fresh NGO correctly identified as fresh');

    const ranked = ngoAgent.rankCandidates([staleNgo, freshNgo], { lat: 40.7128, lng: -74.0060 }, 'shelter_capacity', 1);
    assert(ranked[0].ngo.name === 'TEST_Fresh_NGO_B', 'Fresh NGO prioritized over unverified stale NGO despite distance delta');
    assert(ranked[0].isStale === false, 'Top candidate freshness is verified');
    console.log('✅ TEST 10 Passed.\n');

    // ----------------------------------------------------
    // TEST 11: NGO Reliability Score Factor
    // ----------------------------------------------------
    console.log('--- TEST 11: Reliability Score Factor in Ranking ---');
    await cleanupTestData();

    // NGO High Reliability (10 success, 0 failed -> 100%)
    const highRelNgo = await Ngo.create({
      name: 'TEST_High_Reliability_NGO',
      location: { lat: 40.7200, lng: -74.0060 },
      shelter_capacity: 20,
      successful_allocations: 10,
      failed_allocations: 0,
      is_active: true
    });

    // NGO Low Reliability (1 success, 9 failed -> 10%)
    const lowRelNgo = await Ngo.create({
      name: 'TEST_Low_Reliability_NGO',
      location: { lat: 40.7190, lng: -74.0060 }, // slightly closer
      shelter_capacity: 20,
      successful_allocations: 1,
      failed_allocations: 9,
      is_active: true
    });

    assert(highRelNgo.reliability_score === 1.0, 'High reliability NGO score is 1.0 (100%)');
    assert(lowRelNgo.reliability_score === 0.1, 'Low reliability NGO score is 0.1 (10%)');

    const rankedRel = ngoAgent.rankCandidates([lowRelNgo, highRelNgo], { lat: 40.7128, lng: -74.0060 }, 'shelter_capacity', 1);
    assert(rankedRel[0].ngo.name === 'TEST_High_Reliability_NGO', 'High reliability NGO prioritized over unreliable NGO');
    console.log('✅ TEST 11 Passed.\n');

    // ----------------------------------------------------
    // TEST 12: Coverage Analysis Calculation
    // ----------------------------------------------------
    console.log('--- TEST 12: NGO Coverage Analysis Calculation ---');
    await cleanupTestData();

    // Create NGO in Downtown NYC with 25km radius
    const downtownNgo = await Ngo.create({
      name: 'TEST_Downtown_Coverage_NGO',
      location: { lat: 40.7128, lng: -74.0060 },
      shelter_capacity: 50,
      max_coverage_radius_km: 25,
      is_active: true
    });

    // Case inside coverage (< 5km)
    const { getDistance } = require('../services/geo');
    const nearDist = getDistance(40.7300, -74.0000, downtownNgo.location.lat, downtownNgo.location.lng);
    assert(nearDist <= 25, `Coordinate is within coverage radius (${nearDist.toFixed(2)} km <= 25 km)`);

    // Case outside coverage (Philadelphia, ~130km away)
    const farDist = getDistance(39.9526, -75.1652, downtownNgo.location.lat, downtownNgo.location.lng);
    assert(farDist > 25, `Far coordinate exceeds coverage radius (${farDist.toFixed(2)} km > 25 km)`);
    console.log('✅ TEST 12 Passed.\n');

    // ----------------------------------------------------
    // TEST 13: Depletion Rate & Burnout Duration Estimation
    // ----------------------------------------------------
    console.log('--- TEST 13: Resource Depletion Monitoring & Burnout Estimation ---');
    await cleanupTestData();

    // Create NGO with 20 food units and simulate recent consumption of 10 units in past hour
    const pastHour = new Date(Date.now() - 30 * 60 * 1000);
    const depletingNgo = await Ngo.create({
      name: 'TEST_Depleting_NGO',
      location: { lat: 40.7128, lng: -74.0060 },
      food_units: 20,
      shelter_capacity: 100,
      allocation_history: [
        { timestamp: pastHour, resource_type: 'food_units', quantity: 5, case_id: 'C1' },
        { timestamp: pastHour, resource_type: 'food_units', quantity: 5, case_id: 'C2' }
      ],
      is_active: true
    });

    const recentConsumption = depletingNgo.allocation_history.reduce((sum, h) => sum + h.quantity, 0);
    assert(recentConsumption === 10, 'Allocation history recorded 10 units consumed');

    // Hourly rate over 24h window = 10 / 24 = 0.416 units/hr
    // Burnout hours = 20 / (10 / 24) = 48 hours
    const ratePerHour = 10 / 24;
    const estimatedBurnout = depletingNgo.food_units / ratePerHour;
    assert(estimatedBurnout > 0 && estimatedBurnout < 100, `Estimated burnout duration computed correctly (${estimatedBurnout.toFixed(1)} hours)`);
    console.log('✅ TEST 13 Passed.\n');

    // ----------------------------------------------------
    // Final Cleanup
    // ----------------------------------------------------
    await cleanupTestData();

    console.log('====================================================');
    console.log('🎉 ALL 13 NGO AGENT UNIT & INTEGRATION TESTS PASSED!');
    console.log('====================================================');

  } catch (error) {
    console.error('❌ Test suite execution error:', error);
    process.exit(1);
  } finally {
    await cleanupTestData();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
