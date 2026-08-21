const test = require('node:test');
const assert = require('node:assert/strict');
const {
  screenComplaintQuality,
  normalizeLanguage,
  extractStructuredComplaint,
  detectSemanticDuplicate,
  assessUrgency
} = require('../services/complaintIntel');

test('complaintIntel - screenComplaintQuality', async (t) => {
  await t.test('accepts valid complaint payload', async () => {
    const payload = {
      description: 'Severe flooding near residential area, people need assistance',
      location: { lat: 12.9716, lng: 77.5946 },
      caller_ref: 'caller-101'
    };
    const res = await screenComplaintQuality(payload);
    assert.equal(res.is_valid, true);
    assert.equal(res.quality_flag, 'ok');
    assert.equal(res.reason, null);
  });

  await t.test('flags empty or short description', async () => {
    const payload = {
      description: 'help',
      location: { lat: 12.9716, lng: 77.5946 },
      caller_ref: 'caller-102'
    };
    const res = await screenComplaintQuality(payload);
    assert.equal(res.is_valid, false);
    assert.equal(res.quality_flag, 'flagged_for_review');
    assert.match(res.reason, /too short/i);
  });

  await t.test('flags repetitive character spam', async () => {
    const payload = {
      description: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      location: { lat: 12.9716, lng: 77.5946 },
      caller_ref: 'caller-103'
    };
    const res = await screenComplaintQuality(payload);
    assert.equal(res.is_valid, false);
    assert.equal(res.quality_flag, 'flagged_for_review');
    assert.match(res.reason, /repetitive character spam/i);
  });

  await t.test('flags missing or invalid coordinates', async () => {
    const payload1 = {
      description: 'House collapse with trapped victims',
      location: null,
      caller_ref: 'caller-104'
    };
    const res1 = await screenComplaintQuality(payload1);
    assert.equal(res1.is_valid, false);
    assert.equal(res1.quality_flag, 'flagged_for_review');

    const payload2 = {
      description: 'House collapse with trapped victims',
      location: { lat: 195, lng: 77.5946 },
      caller_ref: 'caller-105'
    };
    const res2 = await screenComplaintQuality(payload2);
    assert.equal(res2.is_valid, false);
    assert.equal(res2.quality_flag, 'flagged_for_review');
    assert.match(res2.reason, /out of range/i);
  });

  await t.test('flags rapid spam bursts from same caller_ref', async () => {
    const payload = {
      description: 'Another message within seconds',
      location: { lat: 12.9716, lng: 77.5946 },
      caller_ref: 'spammer-1'
    };
    const now = new Date();
    const recentComplaints = [
      { created_at: new Date(now - 1000) },
      { created_at: new Date(now - 2000) },
      { created_at: new Date(now - 3000) }
    ];
    const res = await screenComplaintQuality(payload, recentComplaints);
    assert.equal(res.is_valid, false);
    assert.equal(res.quality_flag, 'flagged_for_review');
    assert.match(res.reason, /Spam burst detected/i);
  });
});

test('complaintIntel - normalizeLanguage', async (t) => {
  await t.test('normalizes standard English text', async () => {
    const input = 'Bridge collapsed, urgent help needed';
    const res = await normalizeLanguage(input);
    assert.equal(res.original_text, input);
    assert.equal(res.english_description, input);
    assert.equal(res.original_language, 'en');
    assert.equal(res.method, 'heuristic');
  });

  await t.test('handles non-ASCII text gracefully in heuristic mode', async () => {
    const input = 'बाढ़ के कारण लोग फंसे हैं';
    const res = await normalizeLanguage(input);
    assert.equal(res.original_text, input);
    assert.equal(res.english_description, input);
    assert.equal(res.original_language, 'unknown');
  });
});

test('complaintIntel - extractStructuredComplaint', async (t) => {
  await t.test('extracts injured count and critical keywords', async () => {
    const rawText = '3 people are injured with severe bleeding after roof collapse';
    const res = await extractStructuredComplaint(rawText);
    assert.equal(res.injured_count, 3);
    assert.equal(res.urgency_hint, 'critical');
    assert.ok(res.keywords.includes('bleeding'));
    assert.ok(res.keywords.includes('collapse'));
    assert.equal(res.description, rawText);
  });

  await t.test('handles text without explicit injured counts', async () => {
    const rawText = 'Need food and water for homeless shelter';
    const res = await extractStructuredComplaint(rawText);
    assert.equal(res.injured_count, null);
    assert.ok(res.keywords.includes('food'));
    assert.ok(res.keywords.includes('water'));
  });
});

test('complaintIntel - detectSemanticDuplicate', async (t) => {
  await t.test('returns false when candidate list is empty', async () => {
    const res = await detectSemanticDuplicate('House flooded, need shelter', []);
    assert.equal(res.is_duplicate, false);
    assert.equal(res.confidence, 0);
    assert.equal(res.matched_case_id, null);
  });

  await t.test('detects duplicate when descriptions have high overlap', async () => {
    const candidates = [
      { case_id: 'case-101', description: 'Family of 4 needs shelter, house is flooded' }
    ];
    const newDesc = 'Family of 4 needs a place to sleep, house flooded';
    const res = await detectSemanticDuplicate(newDesc, candidates);
    assert.equal(res.is_duplicate, true);
    assert.equal(res.matched_case_id, 'case-101');
    assert.ok(res.confidence >= 0.40);
  });

  await t.test('returns false for distinct complaints', async () => {
    const candidates = [
      { case_id: 'case-101', description: 'Family of 4 needs shelter, house is flooded' }
    ];
    const newDesc = 'Fire broke out in electrical transformer on main road';
    const res = await detectSemanticDuplicate(newDesc, candidates);
    assert.equal(res.is_duplicate, false);
    assert.equal(res.matched_case_id, null);
  });
});

test('complaintIntel - assessUrgency', async (t) => {
  await t.test('calculates high triage score and detects distress signal', async () => {
    const desc = 'Victim is trapped under concrete slab with heavy bleeding';
    const res = await assessUrgency(desc, 'critical');
    assert.equal(res.triage_score, 5);
    assert.ok(res.distress_signal === 'trapped' || res.distress_signal === 'heavy bleeding');
    assert.equal(res.triage_source, 'heuristic');
  });

  await t.test('calculates lower triage score for low severity complaint', async () => {
    const desc = 'Broken glass on sidewalk, people are scared';
    const res = await assessUrgency(desc, 'low');
    assert.ok(res.triage_score <= 2);
    assert.equal(res.distress_signal, null);
  });
});
