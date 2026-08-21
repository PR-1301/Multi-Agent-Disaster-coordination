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

  } else {
    console.log('Unknown scenario. Use: mass-casualty or resource-drought');
  }
}

runScenario();
