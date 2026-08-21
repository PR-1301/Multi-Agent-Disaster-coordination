const { OpenAI } = require('openai');
require('dotenv').config();

const provider = process.env.LLM_PROVIDER || 'openai';

async function callLLM(promptText) {
  if (!process.env.LLM_API_KEY) {
    throw new Error('LLM_API_KEY not found');
  }

  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey: process.env.LLM_API_KEY });
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
