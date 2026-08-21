require('dotenv').config();
const mongoose = require('mongoose');
const Hospital = require('../models/Hospital');
const Ngo = require('../models/Ngo');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/disaster-coordination';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB for seeding');

  await Hospital.deleteMany({});
  await Ngo.deleteMany({});

  const hospitals = Array.from({ length: 8 }).map((_, i) => ({
    name: `City Hospital ${i + 1}`,
    location: {
      lat: 40.7128 + (Math.random() - 0.5) * 0.1,
      lng: -74.0060 + (Math.random() - 0.5) * 0.1
    },
    bed_count: Math.floor(Math.random() * 50),
    icu_count: Math.floor(Math.random() * 10),
    ambulance_count: Math.floor(Math.random() * 5)
  }));

  const ngos = Array.from({ length: 8 }).map((_, i) => ({
    name: `Relief NGO ${i + 1}`,
    location: {
      lat: 40.7128 + (Math.random() - 0.5) * 0.1,
      lng: -74.0060 + (Math.random() - 0.5) * 0.1
    },
    food_units: Math.floor(Math.random() * 500),
    shelter_capacity: Math.floor(Math.random() * 100),
    supply_units: Math.floor(Math.random() * 200)
  }));

  await Hospital.insertMany(hospitals);
  await Ngo.insertMany(ngos);

  console.log(`Seeded ${hospitals.length} hospitals and ${ngos.length} NGOs`);
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
