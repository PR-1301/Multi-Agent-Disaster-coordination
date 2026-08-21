import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Truck, Package, Activity, Navigation2, Clock } from 'lucide-react';
import HudPanel from '../components/hud/HudPanel';
import AnimatedNumber from '../components/hud/AnimatedNumber';
import TerminalLog from '../components/hud/TerminalLog';

const THEME = {
  primary: '#ffc107',
  highlight: '#ffd54f',
  warning: '#ff9800',
  text: '#fff8e1'
};

const CapacityBar = ({ value, max, color }) => (
  <div className="h-1.5 w-full bg-black/50 border border-[#ffc107]/20 relative overflow-hidden">
    <motion.div 
      className="absolute top-0 left-0 bottom-0"
      style={{ backgroundColor: color }}
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(100, (value/max)*100)}%` }}
      transition={{ duration: 0.8, type: 'spring' }}
    />
  </div>
);

const NgoAgent = ({ data }) => {
  const { activeCount, shelterCapacity, inventory, tasks, logs } = data;
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full flex flex-col gap-4 text-[#fff8e1]" style={{ '--tw-text-opacity': 1 }}>
      {/* Top Bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={24} color={THEME.primary} />
          <h1 className="text-2xl font-bold tracking-widest text-[#ffc107]">RELIEF // NGO LOGISTICS</h1>
          <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-[#ffc107]/10 border border-[#ffc107]/30 rounded-full">
             <div className="w-2 h-2 rounded-full bg-[#ffc107] animate-pulse" />
             <span className="text-xs font-mono text-[#ffc107]">LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#ffc107] uppercase tracking-widest">Active NGOs</span>
            <AnimatedNumber value={activeCount} className="text-2xl text-white" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#ffd54f] uppercase tracking-widest">Network Shelter Capacity</span>
            <AnimatedNumber value={shelterCapacity} className="text-2xl text-white" />
          </div>
          <div className="font-mono text-xl text-[#ffc107]/80 tracking-widest bg-black/40 px-4 py-2 border border-[#ffc107]/20">
            {time}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Network Map */}
        <HudPanel title="NGO Network Map" color={THEME.primary} className="col-span-3">
          <div className="relative w-full h-full min-h-[300px] border border-[#ffc107]/20 bg-black/40 overflow-hidden flex items-center justify-center">
             {/* Mock network nodes */}
             <svg className="absolute inset-0 w-full h-full opacity-30">
                <line x1="20%" y1="30%" x2="50%" y2="50%" stroke={THEME.primary} strokeWidth="1" strokeDasharray="4" />
                <line x1="80%" y1="20%" x2="50%" y2="50%" stroke={THEME.primary} strokeWidth="1" strokeDasharray="4" />
                <line x1="50%" y1="80%" x2="50%" y2="50%" stroke={THEME.primary} strokeWidth="1" strokeDasharray="4" />
             </svg>
             {inventory.map((ngo, i) => {
               const pos = [
                 { top: '30%', left: '20%' },
                 { top: '20%', left: '80%' },
                 { top: '80%', left: '50%' },
                 { top: '50%', left: '50%' }
               ][i % 4];
               return (
                 <div key={ngo.id} className="absolute flex flex-col items-center" style={pos}>
                   <motion.div 
                     className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-black ${ngo.isActive ? 'border-[#ffc107] text-[#ffc107]' : 'border-gray-600 text-gray-600'}`}
                     style={{ boxShadow: ngo.isActive ? `0 0 15px ${THEME.primary}` : 'none' }}
                   >
                     <Activity size={12} />
                   </motion.div>
                   <span className="text-[9px] font-mono mt-1 opacity-75">{ngo.name}</span>
                 </div>
               );
             })}
          </div>
        </HudPanel>

        {/* Center: Inventory Table */}
        <HudPanel title="NGO Inventory & Capacity" color={THEME.primary} className="col-span-6" isReceiving={true}>
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-2">
            {inventory.map((ngo) => (
              <div key={ngo.id} className="p-3 bg-black/60 border border-[#ffc107]/20 flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-[#ffc107]/10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${ngo.isActive ? 'bg-[#ffc107] animate-pulse' : 'bg-gray-600'}`} />
                    <span className="font-bold tracking-wider">{ngo.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-[#ffc107]/70">
                    <span className="flex items-center gap-1"><Clock size={12}/> 2m</span>
                    <span>LOAD: {ngo.workload}</span>
                    <span>REL: {ngo.reliability}%</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-6 text-xs font-mono">
                  <div>
                    <div className="flex justify-between mb-1 text-gray-400"><span>Shelter</span> <span>{ngo.shelterCapacity}</span></div>
                    <CapacityBar value={ngo.shelterCapacity} max={200} color={THEME.primary} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1 text-gray-400"><span>Food Units</span> <span>{ngo.foodUnits}</span></div>
                    <CapacityBar value={ngo.foodUnits} max={600} color={THEME.highlight} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1 text-gray-400"><span>Supply</span> <span>{ngo.supplyUnits}</span></div>
                    <CapacityBar value={ngo.supplyUnits} max={400} color={THEME.warning} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </HudPanel>

        {/* Right: Tasks & Log */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <HudPanel title="Routed Tasks (Auction)" color={THEME.primary} className="flex-1 min-h-0">
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {tasks.map(task => (
                  <motion.div 
                    key={task.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-2 border-l-2 border-[#ffc107] bg-[#ffc107]/10 text-xs font-mono"
                  >
                    <div className="flex justify-between text-[#ffc107] mb-1">
                      <span>{task.id}</span>
                      <span>{task.sectorId}</span>
                    </div>
                    <div className="text-white mb-1">{task.qty}x {task.resource}</div>
                    <div className="text-gray-400 flex justify-between">
                      <span>WINNER:</span>
                      <span className="text-[#ffd54f]">{task.winner}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </HudPanel>
          
          <HudPanel title="Allocation History" color={THEME.primary} className="flex-1 min-h-0">
            <TerminalLog logs={logs} color={THEME.primary} maxLines={10} />
          </HudPanel>
        </div>

      </div>

      {/* Bottom Controls */}
      <div className="grid grid-cols-3 gap-4 font-mono text-xs">
        <HudPanel title="Stock Update" color={THEME.primary} className="col-span-1 h-24 p-2">
          <div className="flex gap-2 h-full items-center justify-around">
            {['Food', 'Shelter', 'Supply'].map(res => (
              <div key={res} className="flex flex-col items-center cursor-pointer hover:text-[#ffc107] transition-colors">
                <Package size={20} className="mb-1" />
                <span>{res}</span>
              </div>
            ))}
          </div>
        </HudPanel>
        <HudPanel title="NGO Status" color={THEME.primary} className="col-span-1 h-24 p-2">
           <div className="flex h-full items-center justify-center gap-4">
             <button className="px-4 py-2 bg-black border border-gray-600 hover:border-[#ffc107] text-gray-400 hover:text-[#ffc107] transition-all">STANDBY</button>
             <button className="px-4 py-2 bg-[#ffc107]/20 border border-[#ffc107] text-[#ffc107] font-bold">ACTIVE</button>
           </div>
        </HudPanel>
        <HudPanel title="Manual Dispatch" color={THEME.primary} className="col-span-1 h-24 p-2">
           <div className="flex h-full items-center gap-2">
             <input type="text" placeholder="SELECT NGO..." className="bg-black border border-[#ffc107]/30 px-3 py-1 flex-1 text-[#ffc107] placeholder-[#ffc107]/30 outline-none" />
             <button className="px-4 py-1.5 bg-[#ffc107]/20 border border-[#ffc107] text-[#ffc107] font-bold flex items-center gap-2 hover:bg-[#ffc107] hover:text-black transition-all">
               <Navigation2 size={14} /> SEND
             </button>
           </div>
        </HudPanel>
      </div>
    </div>
  );
};

export default NgoAgent;
