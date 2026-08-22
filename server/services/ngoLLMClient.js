const { OpenAI } = require('openai');
require('dotenv').config();

/**
 * Calls the LLM to recommend the most suitable NGO candidate based on case details.
 * Implements a timeout to prevent blocking the deterministic pipeline.
 * Returns { recommended_facility_id, reasoning } or null if it fails/times out.
 */
async function evaluateNgoCandidates(caseDetails, candidates) {
  const apiKey = process.env.NGO_LLM_API_KEY;
  
  if (!apiKey) {
    console.log('[ngoLLMClient] NGO_LLM_API_KEY not found. Skipping LLM evaluation (falling back to deterministic).');
    return null;
  }

  const provider = process.env.NGO_LLM_PROVIDER || 'nvidia';
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS, 10) || 5000;

  try {
    const promptText = `
You are an expert disaster relief coordinator.
A case requires resource allocation. Based on the case details, evaluate the given list of eligible NGO candidates.
All candidates provided are verified to have sufficient capacity.
Choose the ONE most suitable facility considering the case's urgency and specifics, compared against candidate distance, workload, reliability, and data freshness.

Case Details:
Urgency: ${caseDetails.urgency || 'Normal'}
Category: ${caseDetails.category || 'Unknown'}
Description: ${caseDetails.description || 'No description provided'}

Candidates:
${candidates.map(c => `- ID: ${c.ngo._id}, Name: "${c.ngo.name}", Distance: ${c.distanceKm}km, Workload: ${c.workload}, Reliability: ${c.reliabilityScore}, IsStale: ${c.isStale}`).join('\n')}

Output STRICT JSON matching exactly this format (do not include markdown blocks, just raw JSON):
{
  "recommended_facility_id": "<ID of the chosen candidate>",
  "reasoning": "<1-2 sentence explanation why this candidate is best for this specific case context>"
}
    `.trim();

    let openai;
    let model;
    
    if (provider === 'nvidia') {
      const baseURL = process.env.NGO_LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
      openai = new OpenAI({ apiKey, baseURL, timeout: 5000 });
      model = process.env.NGO_LLM_MODEL || 'meta/llama-3.1-70b-instruct';
    } else if (provider === 'gemini') {
      openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        timeout: 5000
      });
      model = 'gemini-1.5-flash';
    } else {
      openai = new OpenAI({ apiKey: apiKey, timeout: 5000 });
      model = 'gpt-4o-mini';
    }

    const llmCall = openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: promptText }],
      response_format: { type: "json_object" }
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timed out')), timeoutMs)
    );

    const response = await Promise.race([llmCall, timeoutPromise]);
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    if (!parsed.recommended_facility_id) {
        throw new Error('LLM did not return a recommended_facility_id');
    }

    return parsed;
  } catch (error) {
    console.warn(`[ngoLLMClient] LLM evaluation failed: ${error.message}. Falling back to deterministic ranker.`);
    return null; // Graceful fallback
  }
}

module.exports = { evaluateNgoCandidates };
