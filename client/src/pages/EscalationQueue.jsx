import { useState, useEffect } from 'react';
import socket from '../socket';

export default function EscalationQueue() {
  const [escalations, setEscalations] = useState([]);

  const fetchEscalations = () => {
    fetch('http://localhost:5000/api/escalations')
      .then(res => res.json())
      .then(data => setEscalations(data));
  };

  useEffect(() => {
    fetchEscalations();

    socket.on('escalation-update', fetchEscalations);
    socket.on('case-update', fetchEscalations);

    return () => {
      socket.off('escalation-update', fetchEscalations);
      socket.off('case-update', fetchEscalations);
    };
  }, []);

  const handleResolve = async (id, decision) => {
    try {
      await fetch(`http://localhost:5000/api/escalations/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: 'Resolved via dashboard' })
      });
      fetchEscalations();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold tracking-tight text-red-100">Escalation Queue</h2>
        <p className="text-red-300/70 mt-1">Cases requiring human intervention (ambiguous category, low confidence, or no capacity).</p>
      </header>

      {escalations.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-12 text-center text-gray-400 flex flex-col items-center">
          <div className="bg-gray-700/50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-300">Queue is clear</p>
          <p className="text-sm mt-1">No pending escalations require attention.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {escalations.map(esc => (
            <div key={esc._id} className="bg-gray-800 border border-red-900/30 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-red-700/50 transition-colors">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50"></div>
              
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-mono text-sm text-gray-400 bg-gray-900 px-2 py-1 rounded">Case: {esc.case_id.substring(0, 8)}</h3>
                <span className="text-xs text-gray-500">{new Date(esc.raised_at).toLocaleTimeString()}</span>
              </div>
              
              <p className="text-gray-200 mb-6 font-medium leading-relaxed">
                {esc.reason}
              </p>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => handleResolve(esc._id, 'hospital')}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
                >
                  Force route to Hospital
                </button>
                <button 
                  onClick={() => handleResolve(esc._id, 'ngo')}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20"
                >
                  Force route to NGO
                </button>
                <button 
                  onClick={() => handleResolve(esc._id, 'reject')}
                  className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-red-300 hover:text-red-200 rounded-lg font-medium transition-colors mt-2"
                >
                  Reject Case
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
