const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Ngo = require('./models/Ngo');
const Hospital = require('./models/Hospital');

const DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexus-db';

const ngos = [
  { name: 'Red Cross Central', location: { lat: 28.6139, lng: 77.2090 }, food_units: 300, shelter_capacity: 150, supply_units: 200, is_active: true, contact_phone: '+91 98765 43210' },
  { name: 'Global Relief S-2', location: { lat: 28.6200, lng: 77.2100 }, food_units: 120, shelter_capacity: 80, supply_units: 50, is_active: true, contact_phone: '+91 98765 43211' },
  { name: 'Hope Foundation', location: { lat: 28.6000, lng: 77.2000 }, food_units: 0, shelter_capacity: 50, supply_units: 10, is_active: false, contact_phone: '+91 98765 43212' },
  { name: 'Disaster Aid Network', location: { lat: 28.6500, lng: 77.2500 }, food_units: 450, shelter_capacity: 300, supply_units: 150, is_active: true, contact_phone: '+91 98765 43213' },
];

const hospitals = [
  { name: 'Apollo Main Hospital', sector_id: 'sector_central', location: { lat: 28.6130, lng: 77.2100 }, bed_count: 45, icu_count: 12, ambulance_count: 5 },
  { name: 'City Care Hospital', sector_id: 'sector_north', location: { lat: 28.6800, lng: 77.2200 }, bed_count: 12, icu_count: 2, ambulance_count: 1 },
  { name: 'Trauma Center S-3', sector_id: 'sector_east', location: { lat: 28.6200, lng: 77.2800 }, bed_count: 0, icu_count: 0, ambulance_count: 3 },
  { name: 'Metro Healthcare', sector_id: 'sector_south', location: { lat: 28.5500, lng: 77.2000 }, bed_count: 85, icu_count: 20, ambulance_count: 8 },
];

async function seed() {
  try {
    await mongoose.connect(DB_URI);
    console.log('Connected to MongoDB.');

    await Ngo.deleteMany({});
    console.log('Cleared NGOs.');

    await Hospital.deleteMany({});
    console.log('Cleared Hospitals.');

    await Ngo.insertMany(ngos);
    console.log(`Seeded ${ngos.length} NGOs.`);

    await Hospital.insertMany(hospitals);
    console.log(`Seeded ${hospitals.length} Hospitals.`);

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding DB:', error);
    process.exit(1);
  }
}

seed();
