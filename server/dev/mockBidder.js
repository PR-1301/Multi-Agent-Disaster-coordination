require('dotenv').config();
const { io } = require('socket.io-client');
const axios = require('axios');
const mongoose = require('mongoose');
const Hospital = require('../models/Hospital');
const Ngo = require('../models/Ngo');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:5000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/disaster-coordination';

async function start() {
  console.log('[MockBidder] Starting simulation mode...');
  await mongoose.connect(MONGODB_URI);
  console.log('[MockBidder] Connected to DB to pull real facility IDs.');

  const socket = io(SOCKET_URL);

  socket.on('connect', () => {
    console.log('[MockBidder] Connected to server bus via Socket.io');
  });

  socket.on('case-update', async (data) => {
    if (data.eventName === 'case.routing_requested') {
      const { case_id, payload } = data;
      console.log(`[MockBidder] Heard routing request for case ${case_id}. Generating synthetic bids...`);

      const target = payload.target;
      let facilities = [];
      if (target === 'hospital') {
        facilities = await Hospital.find().limit(3);
      } else {
        facilities = await Ngo.find().limit(3);
      }

      for (const f of facilities) {
        const fit_score = Math.floor(Math.random() * 40) + 60; // 60-100
        const bid = {
          case_id,
          facility_id: f._id,
          facility_type: target,
          facility_name: f.name,
          fit_score,
          distance_km: (Math.random() * 10).toFixed(1),
          capacity_after: Math.floor(Math.random() * 20)
        };

        try {
          // Post the bid to the admin webhook we added
          await axios.post(`${API_URL}/admin/bids`, bid);
          console.log(`[MockBidder] Emitted bid for ${f.name} (fit: ${fit_score})`);
        } catch (err) {
          console.error('[MockBidder] Failed to emit bid:', err.message);
        }
      }
    }
  });
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
