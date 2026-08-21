const { callLLM } = require('./llmClient');

function hasLLMKey() {
  return !!(process.env.LLM_API_KEY || process.env.GEMINI_API_KEY);
}

/**
 * 1. Screen complaint payload for spam / gibberish / invalid input / duplicate caller spam
 */
async function screenComplaintQuality(payload, recentComplaintsFromCaller = []) {
  const desc = (payload.description || '').trim();
  const { location, caller_ref } = payload;

  // Rule 1: Check description quality
  if (!desc || desc.length < 5) {
    return { is_valid: false, reason: 'Description is too short or empty', quality_flag: 'flagged_for_review' };
  }

  // Check for repeated character spam (e.g. "aaaaaa", "asdfasdfasdf")
  const uniqueChars = new Set(desc.toLowerCase().replace(/\s+/g, ''));
  if (desc.length > 10 && uniqueChars.size < 4) {
    return { is_valid: false, reason: 'Description contains repetitive character spam', quality_flag: 'flagged_for_review' };
  }

  // Rule 2: Check location coordinates validity
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return { is_valid: false, reason: 'Missing or invalid location coordinates', quality_flag: 'flagged_for_review' };
  }
  if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
    return { is_valid: false, reason: 'Location coordinates out of range', quality_flag: 'flagged_for_review' };
  }

  // Rule 3: Check rapid spam bursts from same caller_ref (e.g., > 3 submissions in 5 min)
  if (caller_ref && recentComplaintsFromCaller.length >= 3) {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCount = recentComplaintsFromCaller.filter(c => new Date(c.created_at) > fiveMinsAgo).length;
    if (recentCount >= 3) {
      return { is_valid: false, reason: 'Spam burst detected from caller', quality_flag: 'flagged_for_review' };
    }
  }

  // Optional LLM refinement if key present
  if (hasLLMKey()) {
    try {
      const prompt = `Analyze if the following disaster complaint text is genuine disaster-related input or spam/gibberish.
Text: "${desc}"
Respond ONLY with JSON: { "is_valid": true | false, "reason": "<short explanation if invalid>" }`;
      const llmResult = await callLLM(prompt);
      if (llmResult && llmResult.is_valid === false) {
        return { is_valid: false, reason: llmResult.reason || 'LLM flagged as invalid/gibberish', quality_flag: 'flagged_for_review' };
      }
    } catch (err) {
      console.warn(`[complaintIntel] LLM quality screen error, falling back to heuristic: ${err.message}`);
    }
  }

  return { is_valid: true, reason: null, quality_flag: 'ok' };
}

/**
 * 2. Multi-language input handling & normalization
 */
async function normalizeLanguage(description) {
  const text = (description || '').trim();

  if (hasLLMKey()) {
    try {
      const prompt = `Analyze the language of this text. If it is English, set original_language to "en" and english_description to the text.
If it is in another language, set original_language to its ISO code/name and translate it into clear English in english_description.
Text: "${text}"
Respond ONLY with JSON: { "original_language": "<lang>", "english_description": "<translated or original text>" }`;
      const result = await callLLM(prompt);
      if (result && result.english_description) {
        return {
          original_text: text,
          original_language: result.original_language || 'en',
          english_description: result.english_description,
          method: 'llm'
        };
      }
    } catch (err) {
      console.warn(`[complaintIntel] LLM normalize language error, using fallback: ${err.message}`);
    }
  }

  // Heuristic fallback: simple ASCII vs Non-ASCII check
  const isAscii = /^[\x00-\x7F\s.,!?'"()-]+$/.test(text);
  return {
    original_text: text,
    original_language: isAscii ? 'en' : 'unknown',
    english_description: text,
    method: 'heuristic'
  };
}

/**
 * 3. Structured extraction from free-text descriptions
 */
async function extractStructuredComplaint(rawText) {
  const text = (rawText || '').trim();

  if (hasLLMKey()) {
    try {
      const prompt = `Extract structured details from this disaster complaint text.
Text: "${text}"
Respond ONLY with JSON:
{
  "description": "<cleaned concise description>",
  "location_hint": "<extracted location or street or null>",
  "injured_count": <number or null>,
  "urgency_hint": "low" | "medium" | "high" | "critical",
  "keywords": ["<keyword1>", "<keyword2>"]
}`;
      const result = await callLLM(prompt);
      if (result && result.description) {
        return { ...result, method: 'llm' };
      }
    } catch (err) {
      console.warn(`[complaintIntel] LLM structured extraction error, using fallback: ${err.message}`);
    }
  }

  // Heuristic fallback
  let injured_count = null;
  const numMatch = text.match(/(\d+)\s*(people|persons|family|injured|victims|trapped)?/i);
  if (numMatch) {
    injured_count = parseInt(numMatch[1], 10);
  }

  const lower = text.toLowerCase();
  let urgency_hint = 'medium';
  if (lower.includes('bleed') || lower.includes('trapped') || lower.includes('unconscious') || lower.includes('fire')) {
    urgency_hint = 'critical';
  } else if (lower.includes('injur') || lower.includes('smoke') || lower.includes('flood') || lower.includes('breath')) {
    urgency_hint = 'high';
  } else if (lower.includes('glass') || lower.includes('scared') || lower.includes('noise')) {
    urgency_hint = 'low';
  }

  const words = lower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const keywords = [...new Set(words)];

  return {
    description: text,
    location_hint: null,
    injured_count,
    urgency_hint,
    keywords,
    method: 'heuristic'
  };
}

/**
 * 4. Semantic duplicate detection against pre-filtered candidates
 */
async function detectSemanticDuplicate(newDesc, candidateCases) {
  if (!candidateCases || candidateCases.length === 0) {
    return { is_duplicate: false, confidence: 0, method: 'heuristic', matched_case_id: null };
  }

  const targetText = (newDesc || '').toLowerCase();

  if (hasLLMKey()) {
    try {
      const candidatesPayload = candidateCases.map(c => ({
        case_id: c.case_id,
        description: c.description
      }));
      const prompt = `Determine if the new complaint description refers to the exact same incident as any candidate complaint.
New Complaint: "${targetText}"
Candidates: ${JSON.stringify(candidatesPayload)}

Respond ONLY with JSON:
{
  "is_duplicate": true | false,
  "confidence": <float between 0 and 1>,
  "matched_case_id": "<case_id string or null>"
}`;
      const result = await callLLM(prompt);
      if (result && typeof result.is_duplicate === 'boolean') {
        return {
          is_duplicate: result.is_duplicate,
          confidence: result.confidence || (result.is_duplicate ? 0.9 : 0.1),
          method: 'llm',
          matched_case_id: result.is_duplicate ? result.matched_case_id : null
        };
      }
    } catch (err) {
      console.warn(`[complaintIntel] LLM duplicate detection error, using fallback: ${err.message}`);
    }
  }

  // Heuristic fallback: Jaccard similarity between word sets
  const getTokens = (str) => new Set((str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  const targetTokens = getTokens(targetText);

  let bestMatchCaseId = null;
  let maxSimilarity = 0;

  for (const cand of candidateCases) {
    const candTokens = getTokens(cand.description);
    if (targetTokens.size === 0 || candTokens.size === 0) continue;

    let intersection = 0;
    for (const token of targetTokens) {
      if (candTokens.has(token)) intersection++;
    }
    const union = new Set([...targetTokens, ...candTokens]).size;
    const similarity = union > 0 ? intersection / union : 0;

    // Direct substring or high overlap check
    const isSubstring = targetText.length > 10 && (cand.description.toLowerCase().includes(targetText) || targetText.includes(cand.description.toLowerCase()));

    if (isSubstring || similarity > maxSimilarity) {
      maxSimilarity = isSubstring ? Math.max(0.85, similarity) : similarity;
      if (maxSimilarity >= 0.40) {
        bestMatchCaseId = cand.case_id;
      }
    }
  }

  const isDuplicate = maxSimilarity >= 0.40 && !!bestMatchCaseId;
  return {
    is_duplicate: isDuplicate,
    confidence: Math.round(maxSimilarity * 100) / 100,
    method: 'heuristic',
    matched_case_id: isDuplicate ? bestMatchCaseId : null
  };
}

/**
 * 5. Urgency re-scoring / triage score (1-5) & panic distress signal detection
 */
async function assessUrgency(description, callerUrgency) {
  const callerUrgencyMap = { low: 1, medium: 2, high: 4, critical: 5 };
  const callerBaseScore = callerUrgencyMap[callerUrgency] || 2;
  const desc = (description || '').toLowerCase();

  // Check panic / distress signals
  const distressSignals = ['trapped', "can't breathe", 'cant breathe', 'children alone', 'child alone', 'unconscious', 'severe bleeding', 'heavy bleeding', 'drowning'];
  let detectedDistressSignal = null;

  for (const signal of distressSignals) {
    if (desc.includes(signal)) {
      detectedDistressSignal = signal;
      break;
    }
  }

  if (hasLLMKey()) {
    try {
      const prompt = `Assess the severity and triage score of this disaster complaint on a 1-5 scale (1=Minor, 2=Moderate, 3=Urgent, 4=Severe, 5=Critical/Life-threatening).
Caller stated urgency: "${callerUrgency}"
Description: "${desc}"
Respond ONLY with JSON:
{
  "triage_score": <integer 1 to 5>,
  "reasoning": "<short reasoning>"
}`;
      const result = await callLLM(prompt);
      if (result && typeof result.triage_score === 'number') {
        const score = Math.max(1, Math.min(5, Math.round(result.triage_score)));
        return {
          triage_score: score,
          triage_source: 'llm',
          distress_signal: detectedDistressSignal
        };
      }
    } catch (err) {
      console.warn(`[complaintIntel] LLM urgency assessment error, using fallback: ${err.message}`);
    }
  }

  // Heuristic calculation
  let keywordScore = 2;
  if (desc.includes('bleed') || desc.includes('trapped') || desc.includes('unconscious') || desc.includes('fire') || desc.includes('collapse') || desc.includes('drown') || desc.includes('breath')) {
    keywordScore = 5;
  } else if (desc.includes('injur') || desc.includes('flood') || desc.includes('smoke') || desc.includes('severe')) {
    keywordScore = 4;
  } else if (desc.includes('shelter') || desc.includes('cold') || desc.includes('food') || desc.includes('homeless')) {
    keywordScore = 3;
  } else if (desc.includes('scared') || desc.includes('glass') || desc.includes('noise')) {
    keywordScore = 1;
  }

  // Blend caller urgency and keyword score (weighted average)
  const blended = Math.round((callerBaseScore * 0.4) + (keywordScore * 0.6));
  const finalScore = Math.max(1, Math.min(5, blended));

  return {
    triage_score: finalScore,
    triage_source: 'heuristic',
    distress_signal: detectedDistressSignal
  };
}

module.exports = {
  screenComplaintQuality,
  normalizeLanguage,
  extractStructuredComplaint,
  detectSemanticDuplicate,
  assessUrgency
};
