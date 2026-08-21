const { OpenAI } = require('openai');
require('dotenv').config();

const provider = process.env.LLM_PROVIDER || 'openai';

async function callLLM(promptText) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error('LLM_API_KEY or GEMINI_API_KEY not found');
  }

  const provider = process.env.LLM_PROVIDER || 'openai';

  if (provider === 'gemini') {
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
    });
    const response = await openai.chat.completions.create({
      model: 'gemini-1.5-flash',
      messages: [{ role: 'user', content: promptText }],
      response_format: { type: "json_object" }
    });
    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } else if (provider === 'openai') {
    const openai = new OpenAI({ apiKey: apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: promptText }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(response.choices[0].message.content);
  } else {
    throw new Error('Unsupported LLM provider: ' + provider);
  }
}

module.exports = { callLLM };
