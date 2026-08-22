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

import { useNgos } from '../hooks/useNgos';

const NgoAgent = () => {
  const { data, rawNgos, isLoading, isError, updateAvailability, isConnected, isDemo } = useNgos();
  const { activeCount = 0, shelterCapacity = 0, inventory = [], tasks = [], logs = [] } = data || {};
  const [selectedNgoId, setSelectedNgoId] = useState('');
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (rawNgos && rawNgos.length > 0 && !selectedNgoId) {
      setSelectedNgoId(rawNgos[0]._id);
    }
  }, [rawNgos, selectedNgoId]);

  const handleStockUpdate = (resourceType) => {
    if (!selectedNgoId) return;
    const ngo = rawNgos.find(n => n._id === selectedNgoId);
    if (!ngo) return;

    const updates = {};
    if (resourceType === 'Food') updates.food_units = (ngo.food_units || 0) + 50;
    if (resourceType === 'Shelter') updates.shelter_capacity = (ngo.shelter_capacity || 0) + 10;
    if (resourceType === 'Supply') updates.supply_units = (ngo.supply_units || 0) + 20;

    updateAvailability.mutate({ id: selectedNgoId, updates });
  };

  const handleStatusToggle = (isActive) => {
    if (!selectedNgoId) return;
    updateAvailability.mutate({ id: selectedNgoId, updates: { is_active: isActive } });
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-[#ffc107] font-mono">
        <Users size={48} className="animate-pulse opacity-50" />
        <div className="text-xl tracking-[0.2em] animate-pulse">SYNCING LOGISTICS...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-[#ff0000] font-mono">
        <div className="text-xl tracking-[0.2em] font-bold">LOGISTICS UPLINK FAILED</div>
      </div>
    );
  }

  const selectedNgo = rawNgos?.find(n => n._id === selectedNgoId);

  return (
    <div className="h-full flex flex-col gap-4 text-[#fff8e1]" style={{ '--tw-text-opacity': 1 }}>
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users size={24} color={THEME.primary} />
          <h1 className="text-xl sm:text-2xl font-bold tracking-widest text-[#ffc107]">RELIEF // NGO LOGISTICS</h1>
          <div className={`flex items-center gap-2 px-3 py-1 border rounded-full ${isConnected ? 'bg-[#ffc107]/10 border-[#ffc107]/30' : 'bg-gray-800/80 border-gray-600'}`}>
             <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#ffc107] animate-pulse' : 'bg-gray-400'}`} />
             <span className={`text-xs font-mono ${isConnected ? 'text-[#ffc107]' : 'text-gray-400'}`}>
               {isDemo ? 'DEMO MODE' : (isConnected ? 'LIVE' : 'RECONNECTING...')}
             </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#ffc107] uppercase tracking-widest">Active NGOs</span>
            <AnimatedNumber value={activeCount} className="text-xl sm:text-2xl text-white font-bold" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#ffd54f] uppercase tracking-widest">Network Shelter Capacity</span>
            <AnimatedNumber value={shelterCapacity} className="text-xl sm:text-2xl text-white font-bold" />
          </div>
          <div className="font-mono text-lg sm:text-xl text-[#ffc107]/80 tracking-widest bg-black/40 px-3 py-1.5 border border-[#ffc107]/20">
            {time}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Network Map */}
        <HudPanel title="NGO Network Map" color={THEME.primary} className="lg:col-span-3 min-h-[220px]">
          <div className="relative w-full h-full min-h-[200px] border border-[#ffc107]/20 bg-black/40 overflow-hidden flex items-center justify-center rounded">
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
                 <div key={ngo.id} className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2" style={pos}>
                   <motion.div 
                     className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-black ${ngo.isActive ? 'border-[#ffc107] text-[#ffc107]' : 'border-gray-600 text-gray-600'}`}
                     style={{ boxShadow: ngo.isActive ? `0 0 12px ${THEME.primary}` : 'none' }}
                   >
                     <Activity size={12} />
                   </motion.div>
                   <span className="text-[9px] font-mono mt-1 text-white bg-black/80 px-1 rounded border border-[#ffc107]/20 whitespace-nowrap">{ngo.name}</span>
                 </div>
               );
             })}
          </div>
        </HudPanel>

        {/* Center: Inventory Table */}
        <HudPanel title="NGO Inventory & Capacity" color={THEME.primary} className="lg:col-span-6 min-h-[350px]" isReceiving={true}>
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
            {inventory.map((ngo) => (
              <div key={ngo.id} className="p-3.5 bg-black/60 border border-[#ffc107]/25 flex flex-col gap-3 rounded-sm">
                <div className="flex flex-wrap justify-between items-center border-b border-[#ffc107]/15 pb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${ngo.isActive ? 'bg-[#ffc107] animate-pulse' : 'bg-gray-600'}`} />
                    <span className="font-bold tracking-wider text-white">{ngo.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#ffc107]/80">
                    <span className="flex items-center gap-1"><Clock size={12}/> 2m</span>
                    <span>LOAD: <strong className="text-white">{ngo.workload}</strong></span>
                    <span>REL: <strong className="text-[#ffd54f]">{ngo.reliability}%</strong></span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs font-mono">
                  <div>
                    <div className="flex justify-between mb-1 text-gray-400"><span>Shelter</span> <span className="text-white font-semibold">{ngo.shelterCapacity}</span></div>
                    <CapacityBar value={ngo.shelterCapacity} max={200} color={THEME.primary} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1 text-gray-400"><span>Food Units</span> <span className="text-white font-semibold">{ngo.foodUnits}</span></div>
                    <CapacityBar value={ngo.foodUnits} max={600} color={THEME.highlight} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1 text-gray-400"><span>Supply</span> <span className="text-white font-semibold">{ngo.supplyUnits}</span></div>
                    <CapacityBar value={ngo.supplyUnits} max={400} color={THEME.warning} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </HudPanel>

        {/* Right: Tasks & Log */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <HudPanel title="Routed Tasks (Auction)" color={THEME.primary} className="flex-1 min-h-[140px]">
            <div className="flex flex-col gap-2 overflow-y-auto pr-1">
              <AnimatePresence>
                {tasks.map(task => (
                  <motion.div 
                    key={task.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-2 border-l-2 border-[#ffc107] bg-[#ffc107]/10 text-xs font-mono rounded-r"
                  >
                    <div className="flex justify-between text-[#ffc107] mb-1 font-semibold">
                      <span>{task.id}</span>
                      <span>{task.sectorId}</span>
                    </div>
                    <div className="text-white font-medium mb-1">{task.qty}x {task.resource}</div>
                    <div className="text-gray-400 flex justify-between">
                      <span>WINNER:</span>
                      <span className="text-[#ffd54f] font-semibold">{task.winner}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </HudPanel>
          
          <HudPanel title="Allocation History" color={THEME.primary} className="flex-1 min-h-[140px]">
            <TerminalLog logs={logs} color={THEME.primary} maxLines={10} />
          </HudPanel>
        </div>

      </div>

      {/* Bottom Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        <HudPanel title="Stock Update (Target)" color={THEME.primary} className="md:col-span-1 min-h-[90px] p-2">
          <div className="flex flex-col h-full gap-1">
            <select 
              value={selectedNgoId} 
              onChange={e => setSelectedNgoId(e.target.value)}
              className="bg-black border border-[#ffc107]/40 text-[#ffc107] px-2 py-1 outline-none text-[10px]"
            >
              {rawNgos?.map(n => <option key={n._id} value={n._id}>{n.name}</option>)}
            </select>
            <div className="flex gap-2 h-full items-center justify-around flex-1 mt-1">
              {['Food', 'Shelter', 'Supply'].map(res => (
                <div key={res} onClick={() => handleStockUpdate(res)} className="flex flex-col items-center cursor-pointer hover:text-[#ffc107] transition-colors p-1">
                  <Package size={20} className="mb-1 text-[#ffc107]" />
                  <span className="font-semibold">{res}</span>
                </div>
              ))}
            </div>
            {updateAvailability.isError && <div className="text-red-500 text-[9px] text-center">UPDATE FAILED</div>}
          </div>
        </HudPanel>
        <HudPanel title="NGO Status" color={THEME.primary} className="md:col-span-1 min-h-[90px] p-2">
           <div className="flex h-full items-center justify-center gap-3">
             <button 
                onClick={() => handleStatusToggle(false)}
                className={`px-4 py-2 border transition-all rounded cursor-pointer font-bold ${!selectedNgo?.is_active ? 'bg-[#ffc107]/20 border-[#ffc107] text-[#ffc107]' : 'bg-black border-gray-600 hover:border-[#ffc107] text-gray-400 hover:text-[#ffc107]'}`}
             >
                STANDBY
             </button>
             <button 
                onClick={() => handleStatusToggle(true)}
                className={`px-4 py-2 border transition-all rounded cursor-pointer font-bold ${selectedNgo?.is_active ? 'bg-[#ffc107]/20 border-[#ffc107] text-[#ffc107]' : 'bg-black border-gray-600 hover:border-[#ffc107] text-gray-400 hover:text-[#ffc107]'}`}
             >
                ACTIVE
             </button>
           </div>
        </HudPanel>
        
        <HudPanel title="Dispatch & Fulfill Case" color={THEME.primary} className="md:col-span-1 min-h-[90px] p-2">
           <form 
             className="flex items-center gap-2 h-full w-full"
             onSubmit={async (e) => {
               e.preventDefault();
               const caseId = e.target.caseId.value;
               if (!caseId || !selectedNgoId) return;
               try {
                 const apiClient = require('../api/client').default;
                 await apiClient.post(`/cases/${caseId}/fulfill`, {
                   action_summary: `Dispatched resources from ${selectedNgo?.name}`
                 });
                 // Deduct some stock automatically
                 updateAvailability.mutate({
                   id: selectedNgoId,
                   updates: { food_units: Math.max(0, (selectedNgo.food_units || 0) - 10) }
                 });
                 e.target.reset();
               } catch (err) {
                 console.error(err);
               }
             }}
           >
             <input name="caseId" type="text" placeholder="CASE ID (e.g. C-...)" required className="bg-black border border-[#ffc107]/40 px-3 py-2 flex-1 min-w-0 text-[#ffc107] placeholder-[#ffc107]/40 outline-none rounded text-xs uppercase" />
             <button type="submit" className="px-3 py-2 bg-[#ffc107]/20 border border-[#ffc107] text-[#ffc107] font-bold flex items-center gap-1.5 hover:bg-[#ffc107] hover:text-black transition-all shrink-0 rounded cursor-pointer uppercase">
               <Navigation2 size={14} /> FULFILL
             </button>
           </form>
        </HudPanel>
      </div>
    </div>
  );
};

export default NgoAgent;
