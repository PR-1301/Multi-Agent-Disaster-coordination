import React from 'react';
import { useDisasterData } from './hooks/useDisasterData';
import { Case, Hospital, NGO, Escalation } from './types';

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
              {c.assigned_to && <span>Assigned: {c.assigned_to}</span>}
              <span className="capitalize text-indigo-400">{c.category_hint}</span>
            </div>
          </div>
        ))}
        {cases.length === 0 && <p className="text-slate-400 text-center">No active cases.</p>}
      </div>
    </div>
  );
}

function EscalationQueue({ escalations, adminApi, refreshAll }: { escalations: Escalation[], adminApi: string, refreshAll: () => void }) {
  const handleResolve = async (id: string, action: string) => {
    try {
      await fetch(`${adminApi}/escalations/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      refreshAll();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 h-[600px] overflow-y-auto">
      <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          {escalations.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
        Escalation Queue
      </h2>
      <div className="space-y-4">
        {escalations.map(e => (
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
        {escalations.length === 0 && <p className="text-slate-400 text-center">No pending escalations.</p>}
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
            {hospitals.length === 0 && <p className="text-slate-500 text-sm">No hospital data</p>}
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
            {ngos.length === 0 && <p className="text-slate-500 text-sm">No NGO data</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { cases, hospitals, ngos, escalations, refreshAll, ADMIN_API } = useDisasterData();

  return (
    <div className="min-h-screen bg-slate-900 p-6 md:p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          Disaster Coordination Center
        </h1>
        <p className="text-slate-400 mt-2">Multi-Agent Automated Response System</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <CaseBoard cases={cases} />
        </div>
        <div>
          <EscalationQueue escalations={escalations} adminApi={ADMIN_API} refreshAll={refreshAll} />
        </div>
      </div>
      
      <div className="mt-6">
        <ResourceDashboard hospitals={hospitals} ngos={ngos} />
      </div>
    </div>
  );
}

export default App;
