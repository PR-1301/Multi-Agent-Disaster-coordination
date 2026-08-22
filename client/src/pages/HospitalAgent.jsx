import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusSquare, Ambulance, Activity, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import HudPanel from '../components/hud/HudPanel';
import AnimatedNumber from '../components/hud/AnimatedNumber';
import Gauge from '../components/hud/Gauge';

const THEME = {
  primary: '#00e5ff',
  secondary: '#2979ff',
  warning: '#ffc107',
  critical: '#ff1744',
  text: '#e0f7fa'
};

const SaturationGradient = ({ percentage }) => {
  let color = THEME.primary;
  if (percentage > 80) color = THEME.warning;
  if (percentage > 95) color = THEME.critical;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-black border border-gray-700 relative overflow-hidden">
        <motion.div 
          className="absolute top-0 left-0 bottom-0"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1 }}
        />
      </div>
      <span className="font-mono text-sm w-12 text-right" style={{ color }}>{percentage}%</span>
    </div>
  );
};

import { useHospitals } from '../hooks/useHospitals';

const HospitalAgent = () => {
  const { data, rawHospitals, isLoading, isError, updateAvailability, isConnected, isDemo } = useHospitals();
  const { availableBeds = 0, icuBeds = 0, ambulances = 0, facilities = [], queue = [] } = data || {};
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (rawHospitals && rawHospitals.length > 0 && !selectedHospitalId) {
      setSelectedHospitalId(rawHospitals[0]._id);
    }
  }, [rawHospitals, selectedHospitalId]);

  const handleBedUpdate = (type, action) => {
    if (!selectedHospitalId) return;
    const hospital = rawHospitals.find(h => h._id === selectedHospitalId);
    if (!hospital) return;

    const updates = {};
    if (type === 'WARD') {
      const current = hospital.bed_count || 0;
      updates.bed_count = action === 'Admit' ? Math.max(0, current - 1) : current + 1;
    } else if (type === 'ICU') {
      const current = hospital.icu_count || 0;
      updates.icu_count = action === 'Admit' ? Math.max(0, current - 1) : current + 1;
    }

    updateAvailability.mutate({ id: selectedHospitalId, updates });
  };

  const handleDivertToggle = () => {
    if (!selectedHospitalId) return;
    const hospital = rawHospitals.find(h => h._id === selectedHospitalId);
    if (!hospital) return;

    updateAvailability.mutate({ id: selectedHospitalId, updates: { divert: !hospital.divert } });
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-[#00e5ff] font-mono">
        <PlusSquare size={48} className="animate-pulse opacity-50" />
        <div className="text-xl tracking-[0.2em] animate-pulse">ESTABLISHING LINK...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-[#ff0000] font-mono">
        <div className="text-xl tracking-[0.2em] font-bold">MEDICAL UPLINK FAILED</div>
      </div>
    );
  }

  const selectedHospital = rawHospitals?.find(h => h._id === selectedHospitalId);

  return (
    <div className="h-full flex flex-col gap-4 text-[#e0f7fa]" style={{ '--tw-text-opacity': 1 }}>
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PlusSquare size={24} color={THEME.primary} />
          <h1 className="text-xl sm:text-2xl font-bold tracking-widest text-[#00e5ff]">TRIAGE // MEDICAL COMMAND</h1>
          <div className={`flex items-center gap-2 px-3 py-1 border rounded-full ${isConnected ? 'bg-[#00e5ff]/10 border-[#00e5ff]/30' : 'bg-gray-800/80 border-gray-600'}`}>
             <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#00e5ff] animate-pulse' : 'bg-gray-400'}`} />
             <span className={`text-xs font-mono ${isConnected ? 'text-[#00e5ff]' : 'text-gray-400'}`}>
               {isDemo ? 'DEMO MODE' : (isConnected ? 'LIVE' : 'RECONNECTING...')}
             </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#00e5ff] uppercase tracking-widest">Available Beds</span>
            <AnimatedNumber value={availableBeds} className="text-xl sm:text-2xl text-white font-bold" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#2979ff] uppercase tracking-widest">ICU Beds</span>
            <AnimatedNumber value={icuBeds} className="text-xl sm:text-2xl text-white font-bold" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#00e5ff] uppercase tracking-widest">Ambulances</span>
            <AnimatedNumber value={ambulances} className="text-xl sm:text-2xl text-white font-bold" />
          </div>
          <div className="font-mono text-lg sm:text-xl text-[#00e5ff]/80 tracking-widest bg-black/40 px-3 py-1.5 border border-[#00e5ff]/20">
            {time}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Hospital Grid */}
        <HudPanel title="Hospital Grid" color={THEME.primary} className="lg:col-span-3 min-h-[220px]">
          <div className="relative w-full h-full min-h-[200px] border border-[#00e5ff]/20 bg-black/40 overflow-hidden flex items-center justify-center rounded-full p-4">
             {/* Slow rotating scan-ring */}
             <motion.div 
               animate={{ rotate: -360 }}
               transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
               className="absolute inset-2 border-2 border-dashed border-[#00e5ff]/30 rounded-full pointer-events-none"
             />
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3 h-3 bg-[#00e5ff] rounded-full animate-pulse" style={{boxShadow: `0 0 20px ${THEME.primary}`}} />
             </div>
             
             {/* Radial nodes */}
             {facilities.map((hosp, i) => {
               const angle = (i / facilities.length) * Math.PI * 2;
               const radius = 68;
               const x = Math.cos(angle) * radius;
               const y = Math.sin(angle) * radius;
               
               let nodeColor = THEME.primary;
               if (hosp.saturation > 80) nodeColor = THEME.warning;
               if (hosp.saturation > 95 || hosp.divert) nodeColor = THEME.critical;

               return (
                 <div 
                   key={hosp.id} 
                   className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2"
                   style={{ transform: `translate(${x}px, ${y}px)` }}
                 >
                   <motion.div 
                     className="rounded-full flex items-center justify-center border bg-black/80"
                     style={{ 
                       width: 26 + (hosp.bedCount / 12), 
                       height: 26 + (hosp.bedCount / 12),
                       borderColor: nodeColor,
                       boxShadow: `0 0 8px ${nodeColor}60`
                     }}
                   >
                     {hosp.divert ? <AlertCircle size={12} color={THEME.critical} /> : <PlusSquare size={12} color={nodeColor} />}
                   </motion.div>
                   <span className="text-[8px] font-mono mt-0.5 text-white bg-black/80 px-1 rounded border border-[#00e5ff]/20 whitespace-nowrap">{hosp.name}</span>
                 </div>
               );
             })}
          </div>
        </HudPanel>

        {/* Center: Facilities Table */}
        <HudPanel title="Facilities & Bed Status" color={THEME.primary} className="lg:col-span-6 min-h-[350px]" isReceiving={true}>
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
            {facilities.map((hosp) => (
              <div key={hosp.id} className="p-3.5 bg-black/60 border border-[#00e5ff]/25 flex flex-col gap-3 relative overflow-hidden rounded-sm">
                {hosp.divert && <div className="absolute inset-0 bg-[#ff1744]/10 pointer-events-none" />}
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${hosp.divert ? 'bg-[#ff1744] animate-pulse' : 'bg-[#00e5ff]'}`} />
                    <span className="font-bold tracking-wider text-white text-sm">{hosp.name}</span>
                    {hosp.divert && <span className="ml-2 text-[10px] bg-[#ff1744] text-white px-2 py-0.5 uppercase tracking-widest animate-pulse font-bold rounded">Divert Active</span>}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center font-mono text-sm">
                   <div className="sm:col-span-3 flex flex-col gap-0.5">
                     <span className="text-gray-400 text-[10px]">WARD BEDS</span>
                     <div className="flex items-center gap-2 text-[#00e5ff] text-base font-bold">
                       <PlusSquare size={15} /> <AnimatedNumber value={hosp.bedCount} />
                     </div>
                   </div>
                   <div className="sm:col-span-3 flex flex-col gap-0.5">
                     <span className="text-gray-400 text-[10px]">ICU BEDS</span>
                     <div className="flex items-center gap-2 text-[#2979ff] text-base font-bold">
                       <Activity size={15} /> <AnimatedNumber value={hosp.icuCount} />
                     </div>
                   </div>
                   <div className="sm:col-span-6 flex flex-col gap-0.5">
                     <span className="text-gray-400 text-[10px]">SATURATION</span>
                     <SaturationGradient percentage={hosp.saturation} />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </HudPanel>

        {/* Right: Queue & Telemetry */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <HudPanel title="Routing Queue" color={THEME.primary} className="flex-1 min-h-[150px]">
            <div className="flex flex-col gap-2 overflow-y-auto pr-1">
              <AnimatePresence>
                {queue.map(q => (
                  <motion.div 
                    key={q.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-2 border-l-2 text-xs font-mono flex flex-col gap-1 rounded-r ${
                      q.urgency === 'critical' ? 'border-[#ff1744] bg-[#ff1744]/10' : 'border-[#00e5ff] bg-[#00e5ff]/10'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={q.urgency === 'critical' ? 'text-[#ff1744] font-bold' : 'text-[#00e5ff] font-semibold'}>{q.id}</span>
                      <span className={`px-1.5 py-0.2 text-[9px] uppercase font-bold rounded ${q.urgency === 'critical' ? 'bg-[#ff1744] text-white' : 'bg-[#00e5ff]/20 text-[#00e5ff]'}`}>
                        {q.urgency}
                      </span>
                    </div>
                    <div className="text-gray-300 flex justify-between">
                      <span className="font-medium">{q.facility}</span>
                      <span className="text-gray-400">{q.distance}km</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px]">
                      {q.status === 'pending' && <><motion.div animate={{rotate:360}} transition={{repeat:Infinity, duration:1}} className="w-2 h-2 border-t border-[#00e5ff] rounded-full"/> ROUTING...</>}
                      {q.status === 'confirmed' && <><CheckCircle2 size={12} color="#00ff88" /> <span className="text-[#00ff88] font-bold">CONFIRMED</span></>}
                      {q.status === 'failed' && <><XCircle size={12} color="#ff1744" /> <span className="text-[#ff1744] font-bold">DIVERTED</span></>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </HudPanel>
          
          <HudPanel title="Network Telemetry" color={THEME.primary} className="flex-none">
            <div className="grid grid-cols-2 gap-2 place-items-center">
              <Gauge value={88} label="ICU Occ." color={THEME.warning} size={85} />
              <Gauge value={24} label="Rout. Time" color={THEME.secondary} size={85} unit="s" />
            </div>
          </HudPanel>
        </div>

      </div>

      {/* Bottom Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        <HudPanel title="Live Counters (Target)" color={THEME.primary} className="md:col-span-2 min-h-[90px] p-2 flex flex-col">
          <div className="flex flex-col h-full gap-2 px-2">
            <select 
              value={selectedHospitalId} 
              onChange={e => setSelectedHospitalId(e.target.value)}
              className="bg-black border border-[#00e5ff]/40 text-[#00e5ff] px-2 py-1 outline-none text-[10px] w-full max-w-xs"
            >
              {rawHospitals?.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-around flex-1">
              {[
                { label: 'Admit WARD', type: 'WARD', action: 'Admit' },
                { label: 'Discharge WARD', type: 'WARD', action: 'Discharge' },
                { label: 'Admit ICU', type: 'ICU', action: 'Admit' },
                { label: 'Discharge ICU', type: 'ICU', action: 'Discharge' }
              ].map(btn => (
                <button 
                  key={btn.label} 
                  onClick={() => handleBedUpdate(btn.type, btn.action)}
                  className="px-3 py-1.5 bg-black border border-[#00e5ff]/40 text-[#00e5ff] hover:bg-[#00e5ff]/20 transition-all flex items-center gap-1.5 rounded cursor-pointer text-xs shrink-0 font-medium"
                >
                  <Activity size={13} /> {btn.label}
                </button>
              ))}
            </div>
            {updateAvailability.isError && <div className="text-red-500 text-[9px] text-center">UPDATE FAILED</div>}
          </div>
        </HudPanel>
        <HudPanel title="Emergency Control" color={THEME.primary} className="md:col-span-1 min-h-[90px] p-2">
           <div className="flex h-full items-center justify-center">
             <button 
               onClick={handleDivertToggle}
               className={`px-4 py-2 border font-bold tracking-wider transition-all flex items-center gap-2 rounded cursor-pointer text-xs ${selectedHospital?.divert ? 'bg-[#ff1744] text-white border-[#ff1744]' : 'bg-[#ff1744]/20 border-[#ff1744] text-[#ff1744] hover:bg-[#ff1744] hover:text-white'}`}
             >
               <AlertCircle size={15} /> {selectedHospital?.divert ? 'CLEAR DIVERT' : 'TRIGGER NETWORK DIVERT'}
             </button>
           </div>
        </HudPanel>
      </div>
    </div>
  );
};

export default HospitalAgent;
