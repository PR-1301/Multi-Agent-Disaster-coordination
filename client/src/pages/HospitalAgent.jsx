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

const HospitalAgent = ({ data }) => {
  const { availableBeds, icuBeds, ambulances, facilities, queue } = data;
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full flex flex-col gap-4 text-[#e0f7fa]" style={{ '--tw-text-opacity': 1 }}>
      {/* Top Bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlusSquare size={24} color={THEME.primary} />
          <h1 className="text-2xl font-bold tracking-widest text-[#00e5ff]">TRIAGE // MEDICAL COMMAND</h1>
          <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-[#00e5ff]/10 border border-[#00e5ff]/30 rounded-full">
             <div className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse" />
             <span className="text-xs font-mono text-[#00e5ff]">LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#00e5ff] uppercase tracking-widest">Available Beds</span>
            <AnimatedNumber value={availableBeds} className="text-2xl text-white" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#2979ff] uppercase tracking-widest">ICU Beds</span>
            <AnimatedNumber value={icuBeds} className="text-2xl text-white" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#00e5ff] uppercase tracking-widest">Ambulances</span>
            <AnimatedNumber value={ambulances} className="text-2xl text-white" />
          </div>
          <div className="font-mono text-xl text-[#00e5ff]/80 tracking-widest bg-black/40 px-4 py-2 border border-[#00e5ff]/20">
            {time}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Hospital Grid */}
        <HudPanel title="Hospital Grid" color={THEME.primary} className="col-span-3">
          <div className="relative w-full h-full min-h-[300px] border border-[#00e5ff]/20 bg-black/40 overflow-hidden flex items-center justify-center rounded-full">
             {/* Slow rotating scan-ring */}
             <motion.div 
               animate={{ rotate: -360 }}
               transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
               className="absolute inset-2 border-2 border-dashed border-[#00e5ff]/30 rounded-full"
             />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-[#00e5ff] rounded-full animate-pulse" style={{boxShadow: `0 0 20px ${THEME.primary}`}} />
             </div>
             
             {/* Radial nodes */}
             {facilities.map((hosp, i) => {
               const angle = (i / facilities.length) * Math.PI * 2;
               const radius = 100;
               const x = Math.cos(angle) * radius;
               const y = Math.sin(angle) * radius;
               
               let nodeColor = THEME.primary;
               if (hosp.saturation > 80) nodeColor = THEME.warning;
               if (hosp.saturation > 95 || hosp.divert) nodeColor = THEME.critical;

               return (
                 <div 
                   key={hosp.id} 
                   className="absolute flex flex-col items-center justify-center"
                   style={{ transform: `translate(${x}px, ${y}px)` }}
                 >
                   <motion.div 
                     className="rounded-full flex items-center justify-center border bg-black/60"
                     style={{ 
                       width: 30 + (hosp.bedCount / 10), 
                       height: 30 + (hosp.bedCount / 10),
                       borderColor: nodeColor,
                       boxShadow: `0 0 10px ${nodeColor}50`
                     }}
                   >
                     {hosp.divert ? <AlertCircle size={14} color={THEME.critical} /> : <PlusSquare size={14} color={nodeColor} />}
                   </motion.div>
                   <span className="text-[8px] font-mono mt-1 opacity-80 whitespace-nowrap">{hosp.name}</span>
                 </div>
               );
             })}
          </div>
        </HudPanel>

        {/* Center: Facilities Table */}
        <HudPanel title="Facilities & Bed Status" color={THEME.primary} className="col-span-6" isReceiving={true}>
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-2">
            {facilities.map((hosp) => (
              <div key={hosp.id} className="p-3 bg-black/60 border border-[#00e5ff]/20 flex flex-col gap-3 relative overflow-hidden">
                {hosp.divert && <div className="absolute inset-0 bg-[#ff1744]/10 pointer-events-none" />}
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${hosp.divert ? 'bg-[#ff1744]' : 'bg-[#00e5ff]'}`} />
                    <span className="font-bold tracking-wider">{hosp.name}</span>
                    {hosp.divert && <span className="ml-2 text-[10px] bg-[#ff1744] text-white px-2 py-0.5 uppercase tracking-widest animate-pulse">Divert Active</span>}
                  </div>
                </div>
                
                <div className="grid grid-cols-12 gap-4 items-center font-mono text-sm">
                   <div className="col-span-3 flex flex-col gap-1">
                     <span className="text-gray-400 text-[10px]">WARD BEDS</span>
                     <div className="flex items-center gap-2 text-[#00e5ff] text-lg">
                       <PlusSquare size={16} /> <AnimatedNumber value={hosp.bedCount} />
                     </div>
                   </div>
                   <div className="col-span-3 flex flex-col gap-1">
                     <span className="text-gray-400 text-[10px]">ICU BEDS</span>
                     <div className="flex items-center gap-2 text-[#2979ff] text-lg">
                       <Activity size={16} /> <AnimatedNumber value={hosp.icuCount} />
                     </div>
                   </div>
                   <div className="col-span-6 flex flex-col gap-1">
                     <span className="text-gray-400 text-[10px]">SATURATION</span>
                     <SaturationGradient percentage={hosp.saturation} />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </HudPanel>

        {/* Right: Queue & Telemetry */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <HudPanel title="Routing Queue" color={THEME.primary} className="flex-1 min-h-0">
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {queue.map(q => (
                  <motion.div 
                    key={q.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-2 border-l-2 text-xs font-mono flex flex-col gap-1 ${
                      q.urgency === 'critical' ? 'border-[#ff1744] bg-[#ff1744]/10' : 'border-[#00e5ff] bg-[#00e5ff]/10'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={q.urgency === 'critical' ? 'text-[#ff1744] font-bold' : 'text-[#00e5ff]'}>{q.id}</span>
                      <span className={`px-1 text-[9px] uppercase ${q.urgency === 'critical' ? 'bg-[#ff1744] text-white' : 'bg-[#00e5ff]/20 text-[#00e5ff]'}`}>
                        {q.urgency}
                      </span>
                    </div>
                    <div className="text-gray-300 flex justify-between">
                      <span>{q.facility}</span>
                      <span className="text-gray-500">{q.distance}km</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px]">
                      {q.status === 'pending' && <><motion.div animate={{rotate:360}} transition={{repeat:Infinity, duration:1}} className="w-2 h-2 border-t border-[#00e5ff] rounded-full"/> ROUTING...</>}
                      {q.status === 'confirmed' && <><CheckCircle2 size={12} color="#00ff88" /> <span className="text-[#00ff88]">CONFIRMED</span></>}
                      {q.status === 'failed' && <><XCircle size={12} color="#ff1744" /> <span className="text-[#ff1744]">DIVERTED</span></>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </HudPanel>
          
          <HudPanel title="Network Telemetry" color={THEME.primary} className="flex-none">
            <div className="grid grid-cols-2 gap-4 place-items-center">
              <Gauge value={88} label="ICU Occ." color={THEME.warning} size={90} />
              <Gauge value={24} label="Rout. Time" color={THEME.secondary} size={90} unit="s" />
            </div>
          </HudPanel>
        </div>

      </div>

      {/* Bottom Controls */}
      <div className="grid grid-cols-3 gap-4 font-mono text-xs">
        <HudPanel title="Live Counters" color={THEME.primary} className="col-span-2 h-24 p-2">
           <div className="flex gap-4 h-full items-center pl-4">
             {['Admit WARD', 'Discharge WARD', 'Admit ICU', 'Discharge ICU'].map(action => (
               <button key={action} className="px-3 py-2 bg-black border border-[#00e5ff]/40 text-[#00e5ff] hover:bg-[#00e5ff]/20 transition-all flex items-center gap-2">
                 <Activity size={14} /> {action}
               </button>
             ))}
           </div>
        </HudPanel>
        <HudPanel title="Emergency Control" color={THEME.primary} className="col-span-1 h-24 p-2">
           <div className="flex h-full items-center justify-center">
             <button className="px-6 py-2 bg-[#ff1744]/20 border border-[#ff1744] text-[#ff1744] font-bold tracking-widest hover:bg-[#ff1744] hover:text-white transition-all flex items-center gap-2">
               <AlertCircle size={16} /> TRIGGER NETWORK DIVERT
             </button>
           </div>
        </HudPanel>
      </div>
    </div>
  );
};

export default HospitalAgent;
