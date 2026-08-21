import { useState, useEffect } from 'react';
import socket from '../socket';

export default function ResourceDashboard() {
  const [hospitals, setHospitals] = useState([]);
  const [ngos, setNgos] = useState([]);

  const fetchResources = () => {
    fetch('http://localhost:5000/api/hospitals')
      .then(res => res.json())
      .then(setHospitals);
    
    fetch('http://localhost:5000/api/ngos')
      .then(res => res.json())
      .then(setNgos);
  };

  useEffect(() => {
    fetchResources();
    socket.on('resource-update', fetchResources);
    return () => socket.off('resource-update', fetchResources);
  }, []);

  const getCapacityColor = (current, max = 50) => {
    const ratio = current / max;
    if (ratio === 0) return 'text-red-400 bg-red-400/10 border-red-500/20';
    if (ratio < 0.2) return 'text-orange-400 bg-orange-400/10 border-orange-500/20';
    return 'text-green-400 bg-green-400/10 border-green-500/20';
  };

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Facility Network</h2>
        <p className="text-gray-400 mt-1">Live availability across all registered response facilities.</p>
      </header>

      <section>
        <h3 className="text-xl font-semibold mb-4 text-blue-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          Hospitals
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hospitals.map(h => (
            <div key={h._id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors">
              <h4 className="font-semibold text-gray-100 mb-4">{h.name}</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Gen Beds</span>
                  <span className={`px-2 py-0.5 rounded border font-mono font-medium ${getCapacityColor(h.bed_count, 50)}`}>
                    {h.bed_count}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">ICU</span>
                  <span className={`px-2 py-0.5 rounded border font-mono font-medium ${getCapacityColor(h.icu_count, 10)}`}>
                    {h.icu_count}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Ambulances</span>
                  <span className={`px-2 py-0.5 rounded border font-mono font-medium ${getCapacityColor(h.ambulance_count, 5)}`}>
                    {h.ambulance_count}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          NGO Partners
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ngos.map(n => (
            <div key={n._id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors">
              <h4 className="font-semibold text-gray-100 mb-4">{n.name}</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Food Units</span>
                  <span className={`px-2 py-0.5 rounded border font-mono font-medium ${getCapacityColor(n.food_units, 500)}`}>
                    {n.food_units}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Shelter Cap</span>
                  <span className={`px-2 py-0.5 rounded border font-mono font-medium ${getCapacityColor(n.shelter_capacity, 100)}`}>
                    {n.shelter_capacity}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Supplies</span>
                  <span className={`px-2 py-0.5 rounded border font-mono font-medium ${getCapacityColor(n.supply_units, 200)}`}>
                    {n.supply_units}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
