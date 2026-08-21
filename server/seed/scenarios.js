require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Hospital = require('../models/Hospital');

const API_URL = 'http://localhost:3001/api';

async function runScenario() {
  const args = process.argv.slice(2);
  const scenario = args[0];

  if (scenario === 'mass-casualty') {
    console.log('Running mass-casualty scenario...');
    const sector = 'sector_central';
    for (let i = 0; i < 6; i++) {
      try {
        await axios.post(`${API_URL}/complaints`, {
          sector_id: sector,
          caller_ref: `mc_caller_${i}`,
          description: `Huge explosion! Building collapsed, people trapped under rubble, severe bleeding. Send help now!`,
          urgency: 'critical',
          location: { lat: 40.7130 + (Math.random()*0.01), lng: -74.0050 + (Math.random()*0.01) }
        });
        console.log(`Fired case ${i+1}/6`);
      } catch (err) {
        console.error('Error:', err.response?.data || err.message);
      }
    }
    console.log('Done.');
    
  } else if (scenario === 'resource-drought') {
    console.log('Running resource-drought scenario...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/disaster-coordination');
    await Hospital.updateMany({}, { bed_count: 0, icu_count: 0 });
    console.log('Drained all hospital capacity in DB.');
    
    for (let i = 0; i < 3; i++) {
      try {
        await axios.post(`${API_URL}/complaints`, {
          sector_id: 'sector_central',
          caller_ref: `rd_caller_${i}`,
          description: `Severe injuries from car crash, needs immediate ICU!`,
          urgency: 'critical',
          location: { lat: 40.7128, lng: -74.0060 }
        });
        console.log(`Fired medical case ${i+1}/3`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error('Error:', err.response?.data || err.message);
      }
    }
    console.log('Done. Check escalations and capacity risk.');
    process.exit(0);

  } else if (scenario === 'load-test') {
    console.log('Running load-test scenario...');
    const count = parseInt(args[1]) || 10000;
    const batchSize = parseInt(args[2]) || 100;
    
    function pLimit(concurrency) {
      const queue = [];
      let active = 0;
      const next = () => { active--; if (queue.length > 0) queue.shift()(); };
      const run = async (fn, resolve, reject, args) => {
        active++;
        try { resolve(await fn(...args)); } catch (e) { reject(e); }
        next();
      };
      const enqueue = (fn, ...args) => new Promise((resolve, reject) => {
        const task = () => run(fn, resolve, reject, args);
        if (active < concurrency) task(); else queue.push(task);
      });
      return enqueue;
    }
    
    const limit = pLimit(batchSize);

    console.log(`Firing ${count} complaints with concurrency ${batchSize}...`);
    
    let successes = 0;
    let errors = 0;
    const latencies = [];
    
    const startTime = Date.now();
    
    const tasks = Array.from({ length: count }).map((_, i) => limit(async () => {
      const reqStart = Date.now();
      try {
        await axios.post(`${API_URL}/complaints`, {
          sector_id: `sector_${i % 5}`,
          caller_ref: `load_${i}`,
          description: i % 10 === 0 
            ? `Critical structural collapse, people trapped inside burning building` 
            : `Water supply cut off, need help soon`,
          urgency: i % 10 === 0 ? 'critical' : 'low',
          location: { lat: 40.71 + (Math.random()*0.1), lng: -74.00 + (Math.random()*0.1) }
        });
        successes++;
        latencies.push(Date.now() - reqStart);
      } catch (err) {
        errors++;
      }
    }));

    await Promise.all(tasks);
    const totalTime = Date.now() - startTime;
    
    latencies.sort((a,b) => a-b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    
    console.log(`\n=== Load Test Results ===`);
    console.log(`Total complaints: ${count}`);
    console.log(`Total time: ${totalTime}ms (${(count / (totalTime/1000)).toFixed(2)} req/s)`);
    console.log(`Successes: ${successes}`);
    console.log(`Errors: ${errors}`);
    console.log(`P50 Latency: ${p50}ms`);
    console.log(`P95 Latency: ${p95}ms`);
    process.exit(0);

  } else {
    console.log('Unknown scenario. Use: mass-casualty, resource-drought, or load-test');
  }
}

runScenario();
