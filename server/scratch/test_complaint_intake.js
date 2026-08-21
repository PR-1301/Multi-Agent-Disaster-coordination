const mongoose = require('mongoose');
const complaintAgent = require('../agents/complaintAgent');
const Complaint = require('../models/Complaint');
const Case = require('../models/Case');
const EventLog = require('../models/EventLog');
const agentBus = require('../services/agentBus');

require('../agents/adminAgent');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://farahkhathija_db_user:ol7Y6uMqTrAkxyBT@cluster0.5ycpvqx.mongodb.net/?appName=Cluster0';

async function runTests() {
  console.log('--- Connecting to MongoDB ---');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  const testSector = `test-sec-${Date.now()}`;
  const testCaller = `test-caller-${Date.now()}`;

  console.log('\n--- 1. Testing Standard Complaint Intake ---');
  const c1 = await complaintAgent.handleNewComplaint({
    sector_id: testSector,
    caller_ref: testCaller,
    description: 'Severe leg injury with heavy bleeding after roof collapse',
    urgency: 'critical',
    location: { lat: 12.9716, lng: 77.5946 },
    source_command_center: 'center-1'
  });
  console.log('Complaint 1 Result:', c1);

  console.log('\n--- 2. Testing Semantic Duplicate Detection ---');
  const c2 = await complaintAgent.handleNewComplaint({
    sector_id: testSector,
    caller_ref: `test-caller-2-${Date.now()}`,
    description: 'Person with severe leg injury bleeding after roof collapse in same building',
    urgency: 'critical',
    location: { lat: 12.9718, lng: 77.5948 },
    source_command_center: 'center-1'
  });
  console.log('Complaint 2 (Duplicate) Result:', c2);

  console.log('\n--- 3. Testing Quality / Spam Screening (Short text) ---');
  const c3 = await complaintAgent.handleNewComplaint({
    sector_id: testSector,
    caller_ref: `test-caller-3-${Date.now()}`,
    description: 'help',
    urgency: 'low',
    location: { lat: 12.9716, lng: 77.5946 }
  });
  console.log('Complaint 3 (Flagged) Result:', c3);

  console.log('\n--- 4. Testing Flag Clearance ---');
  if (c3.quality_flag === 'flagged_for_review') {
    const cleared = await complaintAgent.clearComplaintFlag(c3.complaint_id);
    console.log('Cleared Flag Result:', cleared);
  }

  console.log('\n--- 5. Checking Flagged Complaints List ---');
  const flaggedList = await complaintAgent.getFlaggedComplaints();
  console.log(`Found ${flaggedList.length} flagged complaints`);

  console.log('\n--- Tests Complete ---');
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('Test failed:', err);
  mongoose.disconnect();
});
