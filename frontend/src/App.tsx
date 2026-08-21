import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useDisasterStore } from './store/DisasterStore';
import { Case, Hospital, NGO, Escalation } from './types';

// Importing agents to instantiate them and attach to the EventBus
import { complaintAgent } from './agents/ComplaintAgent';
import { adminAgent } from './agents/AdminAgent';
import './agents/HospitalAgent'; // Just importing is enough to initialize singleton
import './agents/NGOAgent';

// Demo Data
const hospitalsData: Hospital[] = [
  { id: uuidv4(), name: "Central General", lat: 40.7128, lng: -74.0060, bed_count: 50, icu_count: 10, ambulance_count: 5 },
  { id: uuidv4(), name: "Mercy Care", lat: 40.7300, lng: -73.9900, bed_count: 20, icu_count: 2, ambulance_count: 2 },
  { id: uuidv4(), name: "Northside Med", lat: 40.7500, lng: -73.9800, bed_count: 100, icu_count: 20, ambulance_count: 10 },
  { id: uuidv4(), name: "East River Clinic", lat: 40.7200, lng: -73.9700, bed_count: 5, icu_count: 0, ambulance_count: 1 },
];

const ngosData: NGO[] = [
  { id: uuidv4(), name: "Red Cross NY", lat: 40.7150, lng: -74.0100, food_units: 1000, shelter_capacity: 500, supply_units: 200 },
  { id: uuidv4(), name: "Food Bank Central", lat: 40.7400, lng: -73.9950, food_units: 5000, shelter_capacity: 0, supply_units: 100 },
  { id: uuidv4(), name: "City Rescue Mission", lat: 40.7350, lng: -73.9850, food_units: 500, shelter_capacity: 100, supply_units: 50 },
  { id: uuidv4(), name: "Global Relief Partners", lat: 40.7600, lng: -73.9700, food_units: 2000, shelter_capacity: 200, supply_units: 500 },
];

const complaints = [
  { sector_id: "SEC-1", caller_ref: "CMD-001", description: "Multiple injuries from building collapse, need ambulance and doctor urgently.", urgency: "high", location: { lat: 40.7130, lng: -74.0050 } },
  { sector_id: "SEC-2", caller_ref: "CMD-002", description: "Severe chest pain, suspected heart attack.", urgency: "high", location: { lat: 40.7310, lng: -73.9910 } },
  { sector_id: "SEC-3", caller_ref: "CMD-003", description: "People are homeless and cold, need shelter and blankets.", urgency: "medium", location: { lat: 40.7410, lng: -73.9960 } },
  { sector_id: "SEC-4", caller_ref: "CMD-004", description: "Running out of food and water for 50 people.", urgency: "medium", location: { lat: 40.7160, lng: -74.0120 } },
  { sector_id: "SEC-5", caller_ref: "CMD-005", description: "People are trapped, we need food and a doctor immediately!", urgency: "high", location: { lat: 40.7510, lng: -73.9810 } },
  { sector_id: "SEC-6", caller_ref: "CMD-006", description: "Please send help to main street, it's a disaster.", urgency: "low", location: { lat: 40.7200, lng: -73.9800 } },
  { sector_id: "SEC-1", caller_ref: "CMD-007", description: "More people found with injuries at the building collapse site.", urgency: "high", location: { lat: 40.7131, lng: -74.0049 } },
  { sector_id: "SEC-7", caller_ref: "CMD-008", description: "Building collapsed, 3 people missing in the rubble.", urgency: "high", location: { lat: 40.7300, lng: -74.0000 } },
];

function CaseBoard({ cases }: { cases: Case[] }) {
  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 h-[600px] overflow-y-auto">
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Live Case Board</h2>
      <div className="space-y-3">
        {cases.map(c => (
          <div key={c.id} className="p-4 bg-slate-700 rounded-lg flex flex-col gap-2 border border-slate-600 hover:border-blue-500 transition-colors">
            <div className="flex justify-between items-start">
              <span className="font-semibold text-blue-400">{c.sector_id}</span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                c.urgency === 'high' ? 'bg-red-500/20 text-red-400' :
                c.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>{c.urgency.toUpperCase()}</span>
            </div>
            <p className="text-slate-300 text-sm">{c.description}</p>
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>Status: <span className="text-slate-200 capitalize">{c.status}</span></span>
              {c.assigned_to && <span>Assigned ID: {c.assigned_to.slice(0, 8)}...</span>}
              <span className="capitalize text-indigo-400">{c.category_hint}</span>
            </div>
          </div>
        ))}
        {cases.length === 0 && <p className="text-slate-400 text-center">No active cases.</p>}
      </div>
    </div>
  );
}

function EscalationQueue({ escalations }: { escalations: Escalation[] }) {
  const handleResolve = (id: string, action: string) => {
    adminAgent.resolveEscalation(id, action);
  };

  const pending = escalations.filter(e => e.status === 'pending');

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 h-[600px] overflow-y-auto">
      <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          {pending.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
        Escalation Queue
      </h2>
      <div className="space-y-4">
        {pending.map(e => (
          <div key={e.id} className="p-4 bg-slate-700/50 rounded-lg border border-red-500/30">
            <h3 className="font-semibold text-slate-200 mb-1">Escalation Reason:</h3>
            <p className="text-red-400 text-sm mb-3">{e.reason}</p>
            
            <div className="bg-slate-800 p-3 rounded mb-4 text-sm text-slate-300 border border-slate-600">
              <span className="text-blue-400 font-semibold">{e.case?.sector_id}</span> - {e.case?.description}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <button onClick={() => handleResolve(e.id, 'assigned_hospital')} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-medium transition-colors">Route to Hospital</button>
              <button onClick={() => handleResolve(e.id, 'assigned_ngo')} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-medium transition-colors">Route to NGO</button>
              <button onClick={() => handleResolve(e.id, 'split')} className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-white font-medium transition-colors">Split Case</button>
              <button onClick={() => handleResolve(e.id, 'rejected')} className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-medium transition-colors">Reject</button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-slate-400 text-center">No pending escalations.</p>}
      </div>
    </div>
  );
}

function ResourceDashboard({ hospitals, ngos }: { hospitals: Hospital[], ngos: NGO[] }) {
  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Resource Capacity</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-indigo-400 mb-3 border-b border-slate-700 pb-2">Hospitals</h3>
          <div className="space-y-4">
            {hospitals.map(h => (
              <div key={h.id} className="bg-slate-700 p-3 rounded-lg flex justify-between items-center border border-slate-600">
                <span className="font-medium text-slate-200">{h.name}</span>
                <div className="flex gap-4 text-sm">
                  <span className="flex flex-col items-center">
                    <span className="text-slate-400 text-xs uppercase tracking-wider">Beds</span>
                    <span className={`font-bold ${h.bed_count < 5 ? 'text-red-400' : 'text-emerald-400'}`}>{h.bed_count}</span>
                  </span>
                  <span className="flex flex-col items-center">
                    <span className="text-slate-400 text-xs uppercase tracking-wider">ICU</span>
                    <span className="font-bold text-slate-200">{h.icu_count}</span>
                  </span>
                </div>
              </div>
            ))}
            {hospitals.length === 0 && <p className="text-slate-500 text-sm">No hospital data. Run simulation to seed data.</p>}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-emerald-400 mb-3 border-b border-slate-700 pb-2">NGOs</h3>
          <div className="space-y-4">
            {ngos.map(n => (
              <div key={n.id} className="bg-slate-700 p-3 rounded-lg flex justify-between items-center border border-slate-600">
                <span className="font-medium text-slate-200">{n.name}</span>
                <div className="flex gap-4 text-sm">
                  <span className="flex flex-col items-center">
                    <span className="text-slate-400 text-xs uppercase tracking-wider">Shelter</span>
                    <span className={`font-bold ${n.shelter_capacity < 5 ? 'text-red-400' : 'text-emerald-400'}`}>{n.shelter_capacity}</span>
                  </span>
                  <span className="flex flex-col items-center">
                    <span className="text-slate-400 text-xs uppercase tracking-wider">Food</span>
                    <span className="font-bold text-slate-200">{n.food_units}</span>
                  </span>
                </div>
              </div>
            ))}
            {ngos.length === 0 && <p className="text-slate-500 text-sm">No NGO data. Run simulation to seed data.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const store = useDisasterStore();
  const [isRunning, setIsRunning] = useState(false);

  // Initial load
  useEffect(() => {
    // Optionally seed resources immediately or wait for simulation button
  }, []);

  const runSimulation = () => {
    setIsRunning(true);
    
    // 1. Seed Resources
    store.setHospitals(hospitalsData);
    store.setNGOs(ngosData);
    
    // 2. Dispatch complaints over time to simulate live events
    complaints.forEach((comp, index) => {
      setTimeout(() => {
        complaintAgent.receiveComplaint(comp);
        if (index === complaints.length - 1) {
            setIsRunning(false);
        }
      }, index * 2000); // 2 second delay between each complaint
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6 md:p-8 font-sans">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Disaster Coordination Center
          </h1>
          <p className="text-slate-400 mt-2">Browser-Only Autonomous Agents System</p>
        </div>
        
        <button 
          onClick={runSimulation} 
          disabled={isRunning}
          className={`px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-all ${isRunning ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 hover:-translate-y-1'}`}
        >
          {isRunning ? 'Simulation Running...' : '▶ Run Demo Simulation'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <CaseBoard cases={store.cases} />
        </div>
        <div>
          <EscalationQueue escalations={store.escalations} />
        </div>
      </div>
      
      <div className="mt-6">
        <ResourceDashboard hospitals={store.hospitals} ngos={store.ngos} />
      </div>
    </div>
  );
}

export default App;
