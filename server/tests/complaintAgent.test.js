const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const complaintAgent = require('../agents/complaintAgent');
const Complaint = require('../models/Complaint');
const Case = require('../models/Case');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://farahkhathija_db_user:ol7Y6uMqTrAkxyBT@cluster0.5ycpvqx.mongodb.net/?appName=Cluster0';

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test('ComplaintAgent - handleNewComplaint & Flag Clearance', async (t) => {
  const testSector = `test-sec-${Date.now()}`;
  const testCaller = `test-caller-${Date.now()}`;

  await t.test('handles valid complaint, creates case, and returns triage metadata', async () => {
    const payload = {
      sector_id: testSector,
      caller_ref: testCaller,
      description: 'Severe leg injury after roof collapse with heavy bleeding',
      urgency: 'critical',
      location: { lat: 12.9716, lng: 77.5946 },
      source_command_center: 'center-unit-test'
    };

    const res = await complaintAgent.handleNewComplaint(payload);
    assert.ok(res.case_id);
    assert.ok(res.complaint_id);
    assert.equal(res.duplicate, false);
    assert.equal(res.quality_flag, 'ok');
    assert.equal(res.triage_score, 5);

    // Verify stored complaint record
    const storedComplaint = await Complaint.findById(res.complaint_id);
    assert.ok(storedComplaint);
    assert.equal(storedComplaint.triage_score, 5);
    assert.equal(storedComplaint.triage_source, 'heuristic');
    assert.equal(storedComplaint.status, 'open');
  });

  await t.test('detects semantic duplicate and reuses existing case_id', async () => {
    const payload = {
      sector_id: testSector,
      caller_ref: `caller-dup-${Date.now()}`,
      description: 'Person has severe leg injury after roof collapse in building',
      urgency: 'critical',
      location: { lat: 12.9717, lng: 77.5947 },
      source_command_center: 'center-unit-test'
    };

    const res = await complaintAgent.handleNewComplaint(payload);
    assert.equal(res.duplicate, true);
    assert.ok(res.case_id);
  });

  await t.test('flags low quality submission for review without creating case', async () => {
    const payload = {
      sector_id: testSector,
      caller_ref: `caller-spam-${Date.now()}`,
      description: 'bad',
      urgency: 'low',
      location: { lat: 12.9716, lng: 77.5946 }
    };

    const res = await complaintAgent.handleNewComplaint(payload);
    assert.equal(res.quality_flag, 'flagged_for_review');
    assert.equal(res.status, 'flagged_for_review');

    // Verify case was NOT created in DB for flagged complaint
    const caseRecord = await Case.findOne({ case_id: res.case_id });
    assert.equal(caseRecord, null);
  });

  await t.test('clears complaint flag and re-enters intake flow', async () => {
    const payload = {
      sector_id: testSector,
      caller_ref: `caller-clear-${Date.now()}`,
      description: 'xyz',
      urgency: 'medium',
      location: { lat: 12.9716, lng: 77.5946 }
    };

    const res = await complaintAgent.handleNewComplaint(payload);
    assert.equal(res.quality_flag, 'flagged_for_review');

    const clearedRes = await complaintAgent.clearComplaintFlag(res.complaint_id);
    assert.equal(clearedRes.message, 'Flag cleared successfully');
    assert.equal(clearedRes.complaint.quality_flag, 'ok');
    assert.equal(clearedRes.complaint.status, 'open');

    // Verify Case document is created now
    const caseRecord = await Case.findOne({ case_id: clearedRes.case_id });
    assert.ok(caseRecord);
    assert.equal(caseRecord.status, 'intake');
  });
});
