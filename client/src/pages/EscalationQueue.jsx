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
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-sm text-gray-400 bg-gray-900 px-2 py-1 rounded">Case: {esc.case_id.substring(0, 8)}</h3>
                  <button 
                    onClick={() => {
                      fetch(`http://localhost:5000/api/cases/${esc.case_id}/feedback`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rating: 'up' })
                      });
                    }} 
                    className="text-gray-500 hover:text-green-400 text-xs transition-colors"
                    title="Good Classification"
                  >
                    👍
                  </button>
                  <button 
                    onClick={() => {
                      fetch(`http://localhost:5000/api/cases/${esc.case_id}/feedback`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rating: 'down' })
                      });
                    }} 
                    className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                    title="Bad Classification"
                  >
                    👎
                  </button>
                </div>
                <span className="text-xs text-gray-500">{new Date(esc.raised_at).toLocaleTimeString()}</span>
              </div>
              
              <p className="text-gray-200 mb-2 font-medium leading-relaxed">
                {esc.plain_summary || 'No summary available.'}
              </p>
              
              <details className="mb-6">
                <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">Show Details</summary>
                <div className="mt-2 p-3 bg-gray-900 rounded text-xs text-gray-400 font-mono">
                  {esc.reason}
                </div>
              </details>
              
              {esc.resolved ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-green-400 mb-2 font-medium">Resolved as: {esc.decision}</p>
                  <button 
                    onClick={async () => {
                      await fetch(`http://localhost:5000/api/escalations/${esc._id}/undo`, {
                        method: 'POST',
                        headers: { 'x-admin-token': 'supersecret' }
                      });
                      fetchEscalations();
                    }}
                    className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors shadow-lg"
                  >
                    Undo Resolution
                  </button>
                </div>
              ) : (
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

                  {esc.incident_id && (
                    <button 
                      onClick={async () => {
                        await fetch(`http://localhost:5000/api/incidents/${esc.incident_id}/resolve-all`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-admin-token': 'supersecret' },
                          body: JSON.stringify({ decision: 'hospital', notes: 'Bulk resolved to hospital' })
                        });
                        fetchEscalations();
                      }}
                      className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-purple-900/20 mt-4 border border-purple-400/50"
                    >
                      Resolve ALL in Incident
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
