import { useState, useEffect } from 'react';
import socket from '../socket';

export default function AlertBanner() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const handleAlert = (data) => {
      const { eventName, payload } = data;
      let title = '';
      let message = '';
      let type = 'warning';

      if (eventName === 'incident.severity_raised') {
        title = `Incident Escalated to ${payload.severity}`;
        message = `Incident ${payload.incident_id} is now ${payload.severity}.`;
        type = 'critical';
      } else if (eventName === 'capacity.risk_raised') {
        title = `Capacity Risk: ${payload.sector_id}`;
        message = `Sector ${payload.sector_id} capacity risk score reached ${payload.risk_score.toFixed(2)}.`;
        type = 'warning';
      } else if (eventName === 'circuit.state_changed') {
        title = `Circuit Breaker ${payload.newState}`;
        message = `LLM circuit breaker changed to ${payload.newState}.`;
        type = payload.newState === 'open' ? 'critical' : 'info';
      }

      setAlerts((prev) => [{ id: Date.now() + Math.random(), title, message, type }, ...prev]);
    };

    socket.on('admin-alert', handleAlert);
    return () => socket.off('admin-alert', handleAlert);
  }, []);

  const dismissAlert = (id) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {alerts.map(alert => (
        <div key={alert.id} className={`p-4 rounded shadow-lg flex justify-between items-start border-l-4 ${
          alert.type === 'critical' ? 'bg-red-900 border-red-500 text-white' : 
          alert.type === 'warning' ? 'bg-yellow-900 border-yellow-500 text-white' : 
          'bg-blue-900 border-blue-500 text-white'
        }`}>
          <div>
            <h4 className="font-bold text-sm">{alert.title}</h4>
            <p className="text-xs mt-1 opacity-90">{alert.message}</p>
          </div>
          <button onClick={() => dismissAlert(alert.id)} className="ml-4 text-white opacity-70 hover:opacity-100">
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
