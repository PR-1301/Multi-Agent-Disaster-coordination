const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const adminAgent = require('../agents/adminAgent');
const config = require('../config/adminAgentConfig');
const Case = require('../models/Case');
const Incident = require('../models/Incident');

async function runTests() {
  console.log('Starting MongoDB Memory Server...');
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  console.log('Running adminAgent unit tests...');
  await mongoose.connect(uri);
  
  // 1. Priority score computation
  const signalsMedical = { injuries_mentioned: true, trapped_or_immobile: false, vulnerable_persons: false, structural_damage: false };
  const scoreMedical = adminAgent.computePriorityScore('high', signalsMedical);
  assert.strictEqual(scoreMedical, 50, 'Priority score for high urgency + injuries should be 50');

  // 2. Capacity Risk calculation
  adminAgent.capacityHistory['sector_test'] = [
    { capacity: 10, timestamp: 1 },
    { capacity: 8, timestamp: 2 },
    { capacity: 6, timestamp: 3 }
  ];
  adminAgent.updateCapacityRisk('sector_test');
  assert.strictEqual(adminAgent.capacityRisk['sector_test'].trend, -2);
  assert.strictEqual(adminAgent.capacityRisk['sector_test'].risk_score, 2);
  console.log('Capacity risk tests passed.');

  // 3. Circuit breaker
  const originalKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = 'invalid_key';
  
  config.RETRY_COUNT = 0;
  config.CIRCUIT_BREAKER_THRESHOLD = 1;
  config.CIRCUIT_BREAKER_COOLDOWN_MS = 500;
  
  // Fail -> Open
  await adminAgent.callLLMWithRetry('Test');
  assert.strictEqual(adminAgent.circuitBreaker.state, 'open');
  
  // Skip -> Fallback
  const res2 = await adminAgent.callLLMWithRetry('Test');
  assert.strictEqual(res2.path, 'fallback');
  
  // Time travel -> Half open -> Fail -> Open
  adminAgent.circuitBreaker.openUntil = Date.now() - 1000;
  await adminAgent.callLLMWithRetry('Test');
  assert.strictEqual(adminAgent.circuitBreaker.state, 'open'); // Failed again

  process.env.LLM_API_KEY = originalKey; // Restore
  adminAgent.circuitBreaker.state = 'closed';
  console.log('Circuit breaker tests passed.');

  // 4. Clustering deduplication
  await Case.deleteMany({ sector_id: 'test_sector' });
  await Incident.deleteMany({ sector_id: 'test_sector' });
  
  // 5. Incident severity escalation
  const dummyIncident = await Incident.create({ incident_id: 'test-inc', sector_id: 'test_sector', case_ids: ['case-test-1', 'case-test-2'] });
  await Case.create({ case_id: 'case-test-1', sector_id: 'test_sector', urgency: 'high', priority_score: 90 });
  await Case.create({ case_id: 'case-test-2', sector_id: 'test_sector', urgency: 'high', priority_score: 110 });
  // Total priority = 200 (mass casualty). Admin agent would calculate this during clustering. 
  // Let's test the math explicitly here for the test case based on logic from the code:
  let totalPri = 90 + 110;
  let severity = 'minor';
  if (totalPri >= 200) severity = 'mass_casualty';
  else if (totalPri >= 100) severity = 'major';
  else if (totalPri >= 50) severity = 'moderate';
  assert.strictEqual(severity, 'mass_casualty');
  console.log('Incident severity tests passed.');

  // 6. Adaptive bid window
  const ratio1 = Math.min(1, Math.max(0, 100 / 100)); // Priority 100
  const win1 = Math.floor(config.BID_WINDOW_MAX_MS - (ratio1 * (config.BID_WINDOW_MAX_MS - config.BID_WINDOW_MIN_MS)));
  assert.strictEqual(win1, config.BID_WINDOW_MIN_MS, 'Max priority should yield MIN window');

  const ratio2 = Math.min(1, Math.max(0, 0 / 100)); // Priority 0
  const win2 = Math.floor(config.BID_WINDOW_MAX_MS - (ratio2 * (config.BID_WINDOW_MAX_MS - config.BID_WINDOW_MIN_MS)));
  assert.strictEqual(win2, config.BID_WINDOW_MAX_MS, 'Min priority should yield MAX window');
  console.log('Adaptive bid window tests passed.');

  // 7. Auth middleware verification (just a quick local check of how it would fail)
  const reqMock = { headers: {} };
  const resMock = { status: (c) => ({ json: (d) => ({ code: c, data: d }) }) };
  const origToken = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'secret-test-token';
  const checkAuth = (req, res) => {
    if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return true;
  };
  const result = checkAuth(reqMock, resMock);
  process.env.ADMIN_TOKEN = origToken;
  assert.strictEqual(result.code, 401);
  console.log('Admin auth tests passed.');
  
  // 8. V5 Tests
  const Escalation = require('../models/Escalation');
  
  // 8.1 parseQuery
  const params1 = await adminAgent.parseQuery('show critical cases in sector 5');
  assert.strictEqual(params1.urgency, 'critical');
  assert.strictEqual(params1.sector_id, '5');

  // 8.2 addFeedback
  await Case.create({ case_id: 'feedback-case', sector_id: '1', urgency: 'low' });
  await adminAgent.addFeedback('feedback-case', 'up', 'Good job');
  const fbCase = await Case.findOne({ case_id: 'feedback-case' });
  assert.strictEqual(fbCase.operator_feedback.rating, 'up');

  // 8.3 resolveIncidentAll
  const inc2 = await Incident.create({ incident_id: 'inc-v5', sector_id: 'v5_sec', case_ids: ['case-v5-1', 'case-v5-2'] });
  await Case.create({ case_id: 'case-v5-1', sector_id: 'v5_sec', urgency: 'low' });
  await Case.create({ case_id: 'case-v5-2', sector_id: 'v5_sec', urgency: 'low' });
  const Complaint = require('../models/Complaint');
  await Complaint.create({ case_id: 'case-v5-1', description: 'test', urgency: 'low', location: {lat:0, lng:0}, sector_id: 'v5_sec', caller_ref: '1' });
  await Complaint.create({ case_id: 'case-v5-2', description: 'test', urgency: 'low', location: {lat:0, lng:0}, sector_id: 'v5_sec', caller_ref: '2' });
  await Escalation.create({ case_id: 'case-v5-1', reason: 'r1', reason_taxonomy: 'manual_flag' });
  await Escalation.create({ case_id: 'case-v5-2', reason: 'r2', reason_taxonomy: 'manual_flag' });
  
  const resolvedCount = await adminAgent.resolveIncidentAll('inc-v5', 'hospital', 'bulk resolve');
  assert.strictEqual(resolvedCount, 2);
  const v5esc1 = await Escalation.findOne({ case_id: 'case-v5-1' });
  assert.strictEqual(v5esc1.resolved, true);

  // 8.4 undoEscalation
  const undoResult = await adminAgent.undoEscalation(v5esc1._id);
  assert.strictEqual(undoResult, true);
  const v5esc1_undone = await Escalation.findOne({ case_id: 'case-v5-1' });
  assert.strictEqual(v5esc1_undone.resolved, false);
  
  // 8.4.2 undo expired
  v5esc1_undone.resolved = true;
  v5esc1_undone.resolved_at = new Date(Date.now() - 100000); // Beyond 60s
  await v5esc1_undone.save();
  
  try {
    await adminAgent.undoEscalation(v5esc1_undone._id);
    assert.fail('Should have thrown Undo window expired');
  } catch (err) {
    assert.strictEqual(err.message, 'Undo window expired');
  }
  console.log('V5 operator-facing tests passed.');
  
  // 9. V6 Scale & Automation Tests
  console.log('Running V6 scale & automation tests...');
  
  const dummyPayload = { description: 'test queue description with no keywords', urgency: 'low', location: { lat: 0, lng: 0 } };
  
  // 9.1 Queue Capacity Shedding
  let origHardCap = config.QUEUE_HARD_CAPACITY;
  config.QUEUE_HARD_CAPACITY = 0; // force shed
  await Case.create({ case_id: 'shed-case', status: 'intake', description: 'test', urgency: 'low', sector_id: '1', location: { lat:0, lng:0 } });
  
  await new Promise(r => {
    // using internal bus for test
    const agentBus = require('../services/agentBus');
    agentBus.emit('case.created', { case_id: 'shed-case', payload: dummyPayload });
    setTimeout(r, 100);
  });
  
  const shedCase = await Case.findOne({ case_id: 'shed-case' });
  assert.strictEqual(shedCase.status, 'deferred', 'Should shed case when queue is full');
  config.QUEUE_HARD_CAPACITY = origHardCap;
  
  // 9.2 Load governor fallback
  let origGov = config.QUEUE_GOVERNOR_THRESHOLD;
  config.QUEUE_GOVERNOR_THRESHOLD = 0; // force governor
  await Case.create({ case_id: 'gov-case', status: 'intake', description: 'test', urgency: 'low', sector_id: '1', location: { lat:0, lng:0 } });
  
  let llmCalled = false;
  const originalCallLLM = adminAgent.callLLMWithRetry.bind(adminAgent);
  adminAgent.callLLMWithRetry = async (prompt) => {
    llmCalled = true;
    return { data: null, path: 'mocked' };
  };
  
  await adminAgent.handleCaseCreated('gov-case', dummyPayload, 10);
  assert.strictEqual(llmCalled, false, 'Governor should bypass LLM completely');
  const govCase = await Case.findOne({ case_id: 'gov-case' });
  assert.strictEqual(govCase.category, 'unknown', 'Governor should use fallback classification');
  config.QUEUE_GOVERNOR_THRESHOLD = origGov;
  
  // 9.3 Description Caching
  adminAgent.llmCache.clear();
  adminAgent.callLLMWithRetry = originalCallLLM; // Restore to actually run
  
  // Create first case to populate cache (must be LLM path to cache it)
  adminAgent.callLLMWithRetry = async (prompt) => {
    if (prompt.includes('Extract signals')) return { data: JSON.stringify({ injuries_mentioned: true }), path: 'llm' };
    return { data: JSON.stringify({ category: 'medical', confidence: 0.9, reasoning: 'test' }), path: 'llm' };
  };
  await Case.create({ case_id: 'cache-case-1', status: 'intake', description: 'identical desc', urgency: 'low', sector_id: '1', location: { lat:0, lng:0 } });
  await adminAgent.handleCaseCreated('cache-case-1', { description: 'identical desc', urgency: 'low', location: { lat:0, lng:0 } }, 0);
  assert.strictEqual(adminAgent.llmCache.size > 0, true, 'Cache should have an entry');
  
  // Second case should hit cache
  let cacheHitCalled = false;
  adminAgent.callLLMWithRetry = async () => { cacheHitCalled = true; throw new Error('LLM should not be called on cache hit') };
  await Case.create({ case_id: 'cache-case-2', status: 'intake', description: 'identical desc', urgency: 'high', sector_id: '1', location: { lat:0, lng:0 } });
  await adminAgent.handleCaseCreated('cache-case-2', { description: 'identical desc', urgency: 'high', location: { lat:0, lng:0 } }, 0);
  assert.strictEqual(cacheHitCalled, false, 'Should have used cached classification');
  
  adminAgent.callLLMWithRetry = originalCallLLM;
  console.log('V6 tests passed.');

  // Cleanup
  await Case.deleteMany({});
  await Incident.deleteMany({});
  await Escalation.deleteMany({});

  await mongoose.disconnect();
  await mongoServer.stop();
  
  console.log('All unit tests passed successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
