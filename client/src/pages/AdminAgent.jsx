import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Activity, Terminal, CheckSquare, XSquare, AlertOctagon, Settings } from 'lucide-react';
import HudPanel from '../components/hud/HudPanel';
import TerminalLog from '../components/hud/TerminalLog';
import Gauge from '../components/hud/Gauge';

const THEME = {
  primary: '#00ff88',
  secondary: '#00e5ff',
  warning: '#ffc107',
  critical: '#ff1744',
  text: '#e0fce9'
};

const KanbanColumn = ({ title, items, color }) => (
  <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
    <div className="text-[10px] font-mono tracking-widest text-center border-b pb-1 truncate" style={{ borderColor: `${color}40`, color }}>
      {title} ({items.length})
    </div>
    <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-0.5">
      {items.map(item => (
        <motion.div 
          key={item} 
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black/60 border p-2 text-xs font-mono relative overflow-hidden rounded-xs"
          style={{ borderColor: `${color}40` }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />
          <div className="ml-1 text-gray-300 font-semibold truncate">C-{item}492</div>
          <div className="ml-1 mt-1 text-[9px] text-gray-500 flex justify-between">
            <span>S-12</span>
            <span>P:{Math.floor(Math.random() * 5)+1}</span>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const AdminAgent = ({ data }) => {
  const { health, kanban, escalations, logs } = data;
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  let healthColor = THEME.primary;
  if (health === 'DEGRADED') healthColor = THEME.warning;
  if (health === 'CRITICAL') healthColor = THEME.critical;

  return (
    <div className="h-full flex flex-col gap-4 text-[#e0fce9]" style={{ '--tw-text-opacity': 1 }}>
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Network size={24} color={THEME.primary} />
          <h1 className="text-xl sm:text-2xl font-bold tracking-widest text-[#00ff88]">NEXUS // SYSTEM OVERSIGHT</h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-full">
             <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
             <span className="text-xs font-mono text-[#00ff88]">LIVE</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className={`px-4 sm:px-6 py-1.5 border flex items-center gap-3 rounded`} style={{ borderColor: healthColor, backgroundColor: `${healthColor}20` }}>
            <Activity size={18} color={healthColor} />
            <span className="font-bold tracking-widest uppercase text-xs sm:text-sm" style={{ color: healthColor }}>SYSTEM {health}</span>
          </div>
          <div className="font-mono text-lg sm:text-xl text-[#00ff88]/80 tracking-widest bg-black/40 px-3 py-1.5 border border-[#00ff88]/20">
            {time}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Kanban */}
        <HudPanel title="Global Case Lifecycle" color={THEME.primary} className="lg:col-span-4 min-h-[300px]">
          <div className="flex h-full gap-1.5 sm:gap-2 overflow-x-auto pb-1">
            <KanbanColumn title="INTAKE" items={kanban.intake} color="#888888" />
            <KanbanColumn title="ROUTED" items={kanban.routed} color={THEME.secondary} />
            <KanbanColumn title="ASSIGNED" items={kanban.assigned} color={THEME.primary} />
            <KanbanColumn title="ESCALATED" items={kanban.escalated} color={THEME.warning} />
          </div>
        </HudPanel>

        {/* Center: Escalations */}
        <HudPanel title="Human-in-the-Loop Queue" color={THEME.primary} className="lg:col-span-5 min-h-[350px]" isReceiving={true}>
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
            <AnimatePresence>
              {escalations.map((esc) => (
                <motion.div 
                  key={esc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-black/60 border border-[#00ff88]/30 font-mono text-xs flex flex-col gap-2 rounded-sm"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                    <span className="text-[#00ff88] font-bold text-sm">{esc.id}</span>
                    <span className="bg-[#ffc107]/20 text-[#ffc107] px-2 py-0.5 border border-[#ffc107]/30 rounded text-[10px]">{esc.reason}</span>
                  </div>
                  
                  <div className="bg-black border border-gray-800 p-2 text-gray-400 rounded">
                    <div className="mb-1 text-white font-medium">REASON: {esc.summary}</div>
                    <div className="text-[10px]">ORIGINAL_GUESS: Mixed (Medical, Rescue)</div>
                    <div className="text-[10px]">PROMPT_VERSION: {esc.promptVersion}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-1.5">
                    <button className="py-1.5 px-1 border border-[#00ff88]/50 hover:bg-[#00ff88]/20 text-[#00ff88] flex justify-center items-center gap-1 transition-colors rounded text-[11px] font-semibold cursor-pointer">
                      <CheckSquare size={13} /> RESOLVE
                    </button>
                    <button className="py-1.5 px-1 border border-[#ffc107]/50 hover:bg-[#ffc107]/20 text-[#ffc107] flex justify-center items-center gap-1 transition-colors rounded text-[11px] font-semibold cursor-pointer">
                      <AlertOctagon size={13} /> REASSIGN
                    </button>
                    <button className="py-1.5 px-1 border border-gray-600 hover:bg-gray-800 text-gray-400 flex justify-center items-center gap-1 transition-colors rounded text-[11px] font-semibold cursor-pointer">
                      <XSquare size={13} /> DISMISS
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </HudPanel>

        {/* Right: Telemetry & Terminal */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <HudPanel title="System Telemetry" color={THEME.primary} className="flex-none">
            <div className="grid grid-cols-2 gap-2 place-items-center mb-3">
              <Gauge value={24} label="Pending Tasks" color={THEME.secondary} size={80} unit="" />
              <Gauge value={98} label="Cache Hit" color={THEME.primary} size={80} unit="%" />
            </div>
            <div className="flex justify-between border-t border-[#00ff88]/20 pt-3">
              {['COMPLAINT', 'NGO', 'HOSPITAL'].map((agt, i) => (
                <div key={agt} className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-mono text-gray-400">{agt}</span>
                  <div className={`w-8 h-2 rounded-xs ${i===2 ? 'bg-[#ff1744] animate-pulse shadow-[0_0_8px_#ff1744]' : 'bg-[#00ff88] shadow-[0_0_8px_#00ff88]'}`} />
                </div>
              ))}
            </div>
          </HudPanel>
          
          <HudPanel title="Live Event Log" color={THEME.primary} className="flex-1 min-h-[140px]">
            <TerminalLog logs={logs} color={THEME.primary} maxLines={12} />
          </HudPanel>
        </div>

      </div>

      {/* Bottom Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        <HudPanel title="Threshold Controls" color={THEME.primary} className="md:col-span-2 min-h-[90px] p-2">
           <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 h-full items-center px-4">
             <div className="flex-1 w-full flex flex-col gap-1.5">
               <div className="flex justify-between text-gray-400 text-[10px]"><span>CONFIDENCE THRESHOLD</span> <span className="text-[#00ff88] font-bold">0.85</span></div>
               <input type="range" min="0" max="100" defaultValue="85" className="w-full accent-[#00ff88] cursor-pointer" />
             </div>
             <div className="flex-1 w-full flex flex-col gap-1.5">
               <div className="flex justify-between text-gray-400 text-[10px]"><span>DUP RADIUS (KM)</span> <span className="text-[#00ff88] font-bold">5.0</span></div>
               <input type="range" min="1" max="20" defaultValue="5" className="w-full accent-[#00ff88] cursor-pointer" />
             </div>
           </div>
        </HudPanel>
        <HudPanel title="Operator Override" color={THEME.primary} className="md:col-span-1 min-h-[90px] p-2">
           <div className="flex h-full items-center justify-center gap-4">
             <button className="px-4 py-2 border border-[#00ff88]/40 hover:bg-[#00ff88]/20 text-[#00ff88] transition-all flex items-center gap-2 rounded cursor-pointer font-bold">
               <Settings size={14} /> MODEL CONFIG
             </button>
           </div>
        </HudPanel>
      </div>
    </div>
  );
};

export default AdminAgent;
