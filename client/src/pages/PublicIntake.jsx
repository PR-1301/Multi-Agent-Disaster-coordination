import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, MapPin, Send, Phone, User, Info } from 'lucide-react';
import CaseJourneyTracker from '../components/CaseJourneyTracker';
import apiClient from '../api/client';

const PublicIntake = () => {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    description: '',
    category_hint: '',
    location_str: ''
  });
  
  const [status, setStatus] = useState('idle'); // idle, submitting, success, tracking
  const [referenceCode, setReferenceCode] = useState('');
  const [trackingData, setTrackingData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description) return;

    setStatus('submitting');
    try {
      // Mock geocoding location string to lat/lng for demo purposes
      const lat = 28.6139 + (Math.random() * 0.1 - 0.05);
      const lng = 77.2090 + (Math.random() * 0.1 - 0.05);
      
      const res = await apiClient.post('/public/request', {
        ...formData,
        location: { lat, lng },
        sector_id: `S-${Math.floor(Math.random() * 20) + 1}`
      });
      
      setReferenceCode(res.data.referenceCode);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('idle');
      alert('Failed to submit request. Please try again.');
    }
  };

  useEffect(() => {
    let interval;
    if (status === 'success' || status === 'tracking') {
      const fetchStatus = async () => {
        try {
          const res = await apiClient.get(`/public/status/${referenceCode}`);
          setTrackingData(res.data);
        } catch (err) {
          console.error(err);
        }
      };
      
      fetchStatus();
      interval = setInterval(fetchStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [status, referenceCode]);

  const renderForm = () => (
    <motion.form 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onSubmit={handleSubmit} 
      className="flex flex-col gap-6 w-full max-w-lg mx-auto bg-black/40 border border-gray-800 p-6 rounded shadow-xl"
    >
      <div className="flex flex-col gap-2 border-b border-gray-800 pb-4 mb-2">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShieldAlert className="text-red-500" />
          Emergency Request
        </h2>
        <p className="text-gray-400 text-sm">
          Please provide details about your situation. Your request will be immediately routed to the appropriate relief team.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1"><User size={14}/> Name (Optional)</label>
            <input 
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-red-500 transition-colors"
              placeholder="Your name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1"><Phone size={14}/> Contact</label>
            <input 
              type="text"
              value={formData.contact}
              onChange={e => setFormData(prev => ({...prev, contact: e.target.value}))}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-red-500 transition-colors"
              placeholder="Phone or ID"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1"><MapPin size={14}/> Location</label>
          <input 
            type="text"
            required
            value={formData.location_str}
            onChange={e => setFormData(prev => ({...prev, location_str: e.target.value}))}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-red-500 transition-colors"
            placeholder="Address, landmark, or coordinates"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1"><Info size={14}/> Description</label>
          <textarea 
            required
            rows={4}
            value={formData.description}
            onChange={e => setFormData(prev => ({...prev, description: e.target.value}))}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-red-500 transition-colors resize-none"
            placeholder="Describe the emergency, injuries, structural damage, or trapped persons..."
          />
        </div>
      </div>

      <button 
        type="submit" 
        disabled={status === 'submitting'}
        className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Send size={18} />
        {status === 'submitting' ? 'Transmitting...' : 'Submit Emergency Request'}
      </button>
    </motion.form>
  );

  const renderStatus = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-8 w-full max-w-2xl mx-auto bg-black/40 border border-gray-800 p-8 rounded shadow-xl"
    >
      <div className="text-center flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">Request Received</h2>
        <p className="text-gray-400">Please save your reference code to track your request.</p>
        <div className="text-3xl font-mono text-[#00e5ff] font-bold tracking-widest mt-2 py-4 bg-gray-900/50 rounded border border-gray-800">
          {referenceCode}
        </div>
      </div>

      <div className="mt-4">
        {trackingData ? (
          <CaseJourneyTracker 
            currentStage={trackingData.stage}
            summary={trackingData.summary}
            facility={trackingData.facility}
          />
        ) : (
          <div className="text-center text-gray-500 font-mono animate-pulse">Loading status...</div>
        )}
      </div>
      
      <div className="mt-8 text-center">
        <button 
          onClick={() => {
            setStatus('idle');
            setFormData({ name: '', contact: '', description: '', category_hint: '', location_str: '' });
          }}
          className="text-gray-400 hover:text-white transition-colors underline text-sm"
        >
          Submit another request
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col pt-12 px-4 relative overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      <div className="relative z-10 w-full flex-1 flex flex-col">
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase flex items-center justify-center gap-3">
            <ShieldAlert size={32} className="text-red-500" />
            Disaster Response Network
          </h1>
        </header>

        <AnimatePresence mode="wait">
          {status === 'idle' || status === 'submitting' ? renderForm() : renderStatus()}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PublicIntake;
