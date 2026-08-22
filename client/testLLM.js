const { callLLM } = require('../server/services/llmClient');

async function test() {
  console.log('Testing Nvidia LLM...');
  try {
    const res = await callLLM('Say hello and return {"hello": "world"}');
    console.log('Response:', res);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
