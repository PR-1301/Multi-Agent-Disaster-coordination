import { useState, useEffect } from 'react';
import socket from '../socket';

export default function CaseBoard() {
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState('');
  const [mySector, setMySector] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  const fetchCases = (filters = activeFilters) => {
    const params = new URLSearchParams(filters);
    if (mySector) params.append('sector_id', mySector);
    
    fetch(`http://localhost:5000/api/cases?${params.toString()}`)
      .then(res => res.json())
      .then(data => setCases(data));
  };

  useEffect(() => {
    fetchCases();
    socket.on('case-update', () => fetchCases());
    return () => socket.off('case-update');
  }, [activeFilters, mySector]);

  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!query) {
      setActiveFilters({});
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/admin/parse-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      setActiveFilters(data.filterParams || {});
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      intake: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      routed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      assigned: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
      escalated: 'bg-red-500/20 text-red-400 border-red-500/30',
      rejected: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getUrgencyColor = (urgency) => {
    const colors = {
      low: 'text-gray-400',
      medium: 'text-yellow-400',
      high: 'text-orange-400',
      critical: 'text-red-500 font-bold',
    };
    return colors[urgency] || 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Active Cases</h2>
          <p className="text-gray-400 mt-1">Real-time overview of all disaster coordination cases.</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="flex flex-col items-end">
            <label className="text-xs text-gray-500 mb-1">My Sector Pin</label>
            <input 
              type="text" 
              placeholder="e.g. 4" 
              value={mySector}
              onChange={(e) => setMySector(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:border-blue-500 text-white"
            />
          </div>
          
          <form onSubmit={handleQuerySubmit} className="flex flex-col items-end">
            <label className="text-xs text-gray-500 mb-1">Ask adminAgent (Filter)</label>
            <div className="flex">
              <input 
                type="text" 
                placeholder="e.g. show critical cases" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-l-lg px-4 py-1.5 text-sm w-64 focus:outline-none focus:border-blue-500 text-white"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-r-lg text-sm font-medium transition-colors">
                Apply
              </button>
            </div>
          </form>
        </div>
      </header>

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/50 text-gray-400 border-b border-gray-700 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Sector</th>
                <th className="px-6 py-4 font-semibold">Urgency</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Assigned To</th>
                <th className="px-6 py-4 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">No active cases.</td>
                </tr>
              ) : (
                cases.map(c => (
                  <tr key={c._id} className="hover:bg-gray-750 transition-colors group">
                    <td className="px-6 py-4 font-mono text-gray-300">{c.case_id.substring(0, 8)}</td>
                    <td className="px-6 py-4">{c.sector_id}</td>
                    <td className={`px-6 py-4 uppercase text-xs tracking-wide ${getUrgencyColor(c.urgency)}`}>{c.urgency}</td>
                    <td className="px-6 py-4 capitalize text-gray-300">{c.category || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300 capitalize">{c.assigned_facility_type || '-'}</td>
                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                      {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button 
                        onClick={() => {
                          fetch(`http://localhost:5000/api/cases/${c.case_id}/feedback`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rating: 'up' })
                          });
                        }} 
                        className="text-gray-500 hover:text-green-400 mr-2 transition-colors"
                        title="Good Classification"
                      >
                        👍
                      </button>
                      <button 
                        onClick={() => {
                          fetch(`http://localhost:5000/api/cases/${c.case_id}/feedback`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rating: 'down' })
                          });
                        }} 
                        className="text-gray-500 hover:text-red-400 transition-colors"
                        title="Bad Classification"
                      >
                        👎
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
