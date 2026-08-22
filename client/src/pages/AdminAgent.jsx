import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Activity, CheckSquare, XSquare, AlertOctagon, Settings } from 'lucide-react';
import TerminalLog from '../components/hud/TerminalLog';

const THEME = {
  primary: '#00ff88',
  secondary: '#00e5ff', // Cyan for live data
  warning: '#ffc107',
  critical: '#ff1744',
  text: '#e0fce9',
  bg: 'rgba(0,255,136,0.02)'
};

// -------------------------------------------------------------
// 3. SEQUENTIAL POWER-ON REVEAL PANEL
// -------------------------------------------------------------
const RevealPanel = ({ title, children, color = THEME.primary, delay = 0, className = "" }) => {
  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Animated SVG Border Trace */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <motion.rect
          x="0" y="0" width="100%" height="100%"
          fill={THEME.bg}
          stroke={color}
          strokeWidth="1"
          strokeOpacity="0.4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay, ease: "easeInOut" }}
        />
        {/* Subtle corner ticks */}
        <motion.path
          d="M 0 10 L 0 0 L 10 0 M 100% 10 L 100% 0 L calc(100% - 10px) 0 M 0 calc(100% - 10px) L 0 100% L 10 100% M 100% calc(100% - 10px) L 100% 100% L calc(100% - 10px) 100%"
          fill="none" stroke={color} strokeWidth="2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 0.2, delay: delay + 0.8 }}
        />
      </svg>
      
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: delay + 0.5 }}
        className="relative z-10 flex flex-col h-full min-h-0 p-3"
      >
        {title && (
          <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-1">
            <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color }}>{title}</span>
          </div>
        )}
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// -------------------------------------------------------------
// 4. DATA MATERIALIZATION (SCAN-LINE VALUE)
// -------------------------------------------------------------
const ScanlineValue = ({ value, prefix = "", suffix = "", delay = 0 }) => {
  const [resolved, setResolved] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(() => setResolved(true), delay * 1000 + 400);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="relative inline-block overflow-hidden font-mono text-sm tracking-tight">
      <motion.div 
        className="absolute top-0 bottom-0 left-0 w-[2px] bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] z-20"
        initial={{ x: -10, opacity: 0 }}
        animate={{ x: 100, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.6, delay, ease: "linear" }}
      />
      <motion.span
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)", color: resolved ? THEME.text : THEME.secondary }}
        transition={{ duration: 0.1, delay: delay + 0.3 }}
      >
        {prefix}{value}{suffix}
      </motion.span>
    </div>
  );
};

// -------------------------------------------------------------
// 2. CONCENTRIC RING HUD ELEMENTS
// -------------------------------------------------------------
const ConcentricRing = ({ value = 100, max = 100, size = 60, color = THEME.primary, label, isBreaker = false }) => {
  const center = size / 2;
  const strokeWidth = 1.5;
  const radius1 = center - 4;
  const radius2 = center - 12;
  
  const circ1 = 2 * Math.PI * radius1;
  const circ2 = 2 * Math.PI * radius2;
  const pct = value / max;
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90 absolute inset-0">
          {/* Outer ring (calibrating, spinning) */}
          <motion.circle
            cx={center} cy={center} r={radius1}
            fill="none" stroke={color} strokeWidth={0.5} strokeOpacity="0.3"
            strokeDasharray="4 8"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            style={{ originX: "50%", originY: "50%" }}
          />
          {/* Outer Ring Tick Marks */}
          <circle cx={center} cy={center} r={radius1} fill="none" stroke={color} strokeWidth={strokeWidth} strokeOpacity="0.1" />

          {/* Inner Ring (Value/Breaker State) */}
          {isBreaker ? (
            <motion.circle
              cx={center} cy={center} r={radius2}
              fill="none" stroke={color} strokeWidth={strokeWidth}
              strokeDasharray={pct === 1 ? circ2 : `${circ2 * 0.4} ${circ2 * 0.1}`}
              animate={pct < 1 ? { strokeOpacity: [1, 0.4, 1] } : {}}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{ filter: `drop-shadow(0 0 2px ${color})` }}
            />
          ) : (
            <circle
              cx={center} cy={center} r={radius2}
              fill="none" stroke={color} strokeWidth={strokeWidth}
              strokeDasharray={`${circ2 * pct} ${circ2}`}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold" style={{ color: isBreaker && pct < 1 ? THEME.critical : THEME.secondary }}>
           {isBreaker ? (pct === 1 ? 'CLS' : 'OPN') : `${Math.floor(pct * 100)}%`}
        </div>
      </div>
      {label && <div className="text-[8px] font-mono tracking-widest uppercase opacity-70 text-center w-16">{label}</div>}
    </div>
  );
};

// -------------------------------------------------------------
// 1. THE VIRTUAL BRAIN NEURAL CORE (MASSIVE SCALE)
// -------------------------------------------------------------
const NeuralCore = () => {
  const [pulses, setPulses] = useState([]);
  const [computeData, setComputeData] = useState([]);
  const requestCount = useRef(0);
  const [displayCount, setDisplayCount] = useState(0);

  // Generate a dense, screen-filling brain network (1200x600 scale)
  const nodes = React.useMemo(() => {
    const arr = [];
    // Central core hubs (centered at x=600, y=300)
    for(let i=0; i<10; i++) {
       arr.push({ id: `hub-${i}`, x: 600 + (Math.random()*200-100), y: 300 + (Math.random()*120-60), r: 6, type: 'hub' });
    }
    // Cortex perimeter (left and right lobes)
    for(let i=0; i<80; i++) {
       const isLeft = Math.random() > 0.5;
       const cx = isLeft ? 350 : 850; // Spread wide left and right
       const angle = Math.random() * Math.PI * 2;
       const radius = 100 + Math.random() * 250;
       arr.push({ 
         id: `node-${i}`, 
         x: cx + Math.cos(angle) * radius, 
         y: 300 + Math.sin(angle) * (radius * 0.9), 
         r: 2.5, 
         type: 'synapse' 
       });
    }
    return arr;
  }, []);

  const edges = React.useMemo(() => {
    const arr = [];
    // Connect hubs to hubs
    for(let i=0; i<10; i++) {
       for(let j=i+1; j<10; j++) arr.push([i, j]);
    }
    // Connect synapses to hubs and nearby synapses
    for(let i=10; i<nodes.length; i++) {
       arr.push([i, Math.floor(Math.random()*10)]);
       arr.push([i, 10 + Math.floor(Math.random()*(nodes.length-10))]);
       arr.push([i, 10 + Math.floor(Math.random()*(nodes.length-10))]);
    }
    return arr;
  }, [nodes]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Spawn massive pulse waves
      const newPulses = Array.from({ length: 8 }).map(() => {
         const edge = edges[Math.floor(Math.random() * edges.length)];
         const n1 = nodes[edge[0]];
         const n2 = nodes[edge[1]];
         return { id: Math.random().toString(), x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y };
      });
      
      setPulses(curr => [...curr.slice(-60), ...newPulses]);
      
      requestCount.current += Math.floor(Math.random() * 1500) + 500;
      setDisplayCount(requestCount.current);

      if (Math.random() > 0.3) {
        setComputeData(curr => [...curr.slice(-8), {
          id: Math.random().toString(),
          x: Math.random() * 1100 + 50,
          y: Math.random() * 500 + 50,
          text: `0x${Math.floor(Math.random()*16777215).toString(16).toUpperCase()}`
        }]);
      }
    }, 50); 

    return () => clearInterval(interval);
  }, [edges, nodes]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.05)_0%,transparent_80%)]">
      <div className="absolute top-4 left-4 z-10 flex flex-col pointer-events-none">
         <span className="text-[9px] font-mono text-[#00e5ff] tracking-widest opacity-80 mb-1">VIRTUAL NEURAL CORE // LIVE COMPUTE</span>
         <span className="text-2xl font-mono text-white tracking-tighter" style={{ textShadow: '0 0 12px rgba(0,229,255,0.5)' }}>
            {displayCount.toLocaleString()}<span className="text-[#00ff88] text-xs tracking-widest ml-2">OPS/s</span>
         </span>
      </div>

      <svg viewBox="0 0 1200 600" className="w-full h-full z-0">
        <defs>
          <radialGradient id="nodeGlow">
            <stop offset="0%" stopColor={THEME.secondary} stopOpacity="1"/>
            <stop offset="100%" stopColor={THEME.secondary} stopOpacity="0"/>
          </radialGradient>
        </defs>

        <AnimatePresence>
          {computeData.map(d => (
            <motion.text
              key={d.id}
              x={d.x} y={d.y}
              fill={THEME.secondary}
              fontSize="16"
              fontFamily="monospace"
              fontWeight="bold"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 0.8, 0], y: -50 }}
              transition={{ duration: 1.5, ease: "linear" }}
            >
              {d.text}
            </motion.text>
          ))}
        </AnimatePresence>

        {edges.map((e, i) => (
          <line key={i} x1={nodes[e[0]].x} y1={nodes[e[0]].y} x2={nodes[e[1]].x} y2={nodes[e[1]].y} stroke={THEME.primary} strokeWidth="0.6" strokeOpacity="0.4" />
        ))}

        {nodes.map(n => (
          <g key={n.id}>
             <circle cx={n.x} cy={n.y} r={n.r * 2.5} fill="none" stroke={n.type === 'hub' ? THEME.secondary : THEME.primary} strokeWidth="1.5" strokeOpacity="0.6" />
             <circle cx={n.x} cy={n.y} r={n.r} fill={n.type === 'hub' ? THEME.secondary : THEME.primary} />
          </g>
        ))}

        {pulses.map(p => (
          <motion.circle
            key={p.id}
            r={3.5}
            fill={THEME.secondary}
            style={{ filter: `drop-shadow(0 0 10px ${THEME.secondary})` }}
            initial={{ cx: p.x1, cy: p.y1, opacity: 0 }}
            animate={{ cx: p.x2, cy: p.y2, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.2 + Math.random()*0.3, ease: "linear" }}
          />
        ))}
        
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} style={{ originX: "600px", originY: "300px" }}>
           <circle cx="600" cy="300" r="240" fill="none" stroke={THEME.secondary} strokeWidth="1.5" strokeOpacity="0.15" strokeDasharray="6 24" />
           <circle cx="600" cy="300" r="280" fill="none" stroke={THEME.primary} strokeWidth="2" strokeOpacity="0.08" strokeDasharray="3 12" />
        </motion.g>
      </svg>
    </div>
  );
};

// -------------------------------------------------------------
// 5. KANBAN AS SIGNAL PATHS
// -------------------------------------------------------------
const KanbanBoard = ({ kanban }) => {
  const cols = [
    { id: 'intake', title: 'INTAKE', items: kanban.intake },
    { id: 'routed', title: 'ROUTED', items: kanban.routed },
    { id: 'assigned', title: 'ASSIGNED', items: kanban.assigned },
    { id: 'escalated', title: 'ESCALATED', items: kanban.escalated }
  ];

  return (
    <div className="flex h-full gap-8 relative items-start pb-4">
      {cols.map((col, idx) => (
        <div key={col.id} className="flex-1 flex flex-col min-w-[100px] z-10 min-h-0 h-full">
          <div className="text-[9px] font-mono tracking-widest text-[#00ff88] border-b border-[#00ff88]/30 pb-1 mb-3">
             <ScanlineValue value={col.title} delay={1.5 + (idx*0.2)} /> [{col.items.length}]
          </div>
          {/* Using CSS class to hide scrollbar for sleek HUD feel */}
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 no-scrollbar">
            {col.items.map((item, i) => (
              <motion.div 
                key={item}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 2 + (i*0.1) }}
                className="border border-[#00ff88]/20 bg-black/40 p-1.5 text-[9px] font-mono text-[#00e5ff] flex justify-between"
              >
                <span>C-{item}</span>
                <span className="opacity-50">S12</span>
              </motion.div>
            ))}
          </div>
        </div>
      ))}

      {/* Signal Paths Between Columns */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="none">
         <line x1="25%" y1="20" x2="33%" y2="20" stroke={THEME.primary} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2 4" />
         <line x1="50%" y1="20" x2="58%" y2="20" stroke={THEME.primary} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2 4" />
         <line x1="75%" y1="20" x2="83%" y2="20" stroke={THEME.primary} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2 4" />
      </svg>
    </div>
  );
};


// -------------------------------------------------------------
// MAIN PAGE COMPONENT
// -------------------------------------------------------------
import { useAdmin } from '../hooks/useAdmin';

const AdminAgent = () => {
  const { data, isLoading, isError, resolveEscalation, dismissEscalation, isConnected, isDemo } = useAdmin();
  const { health = 'HEALTHY', kanban = { intake: [], routed: [], assigned: [], escalated: [] }, escalations = [], logs = [] } = data || {};
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-[#00ff88] font-mono">
        <Network size={48} className="animate-pulse opacity-50" />
        <div className="text-xl tracking-[0.2em] animate-pulse">CONNECTING TO NEXUS...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-[#ff1744] font-mono">
        <div className="text-xl tracking-[0.2em] font-bold">NEXUS CONNECTION LOST</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 text-[#e0fce9]" style={{ '--tw-text-opacity': 1 }}>
      {/* Engineered Top Bar */}
      <header className="flex items-end justify-between border-b border-[#00ff88]/20 pb-2">
        <div className="flex items-center gap-4">
          <Network size={20} color={THEME.primary} strokeWidth={1.5} />
          <div className="flex flex-col">
             <h1 className="text-xl font-mono font-bold tracking-[0.2em] text-[#00ff88] leading-none mb-1">NEXUS // SYS_OVERSIGHT</h1>
             <span className="text-[9px] font-mono tracking-widest text-[#00e5ff]">GLOBAL COMMAND NODE ACTIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-8 font-mono">
          <div className="flex flex-col items-end">
            <span className="text-[8px] tracking-widest text-gray-500">SYSTEM HEALTH</span>
            <span className="text-sm tracking-widest" style={{ color: health === 'CRITICAL' ? THEME.critical : THEME.primary }}>
               <ScanlineValue value={health} delay={0.2} />
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] tracking-widest text-gray-500">LOCAL TIME</span>
            <span className="text-sm tracking-widest text-[#00e5ff]">{time}</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        
        {/* Center/Left: Neural Core & Kanban */}
        <div className="col-span-8 flex flex-col gap-4 min-h-0">
          
          {/* Neural Core */}
          <RevealPanel title="Agent Network Topology" className="flex-[3] min-h-0" delay={0.2}>
             <NeuralCore />
          </RevealPanel>

          {/* Kanban Signal Paths */}
          <RevealPanel title="Global Case Signal Flow" className="flex-1 min-h-0" delay={0.4}>
             <KanbanBoard kanban={kanban} />
          </RevealPanel>
        </div>

        {/* Right: Escalations & Telemetry */}
        <div className="col-span-4 flex flex-col gap-4 min-h-0">
          
          {/* Top Right: Breakers & Gauges */}
          <RevealPanel title="Telemetry & Safeguards" className="flex-none h-32" delay={0.6}>
             <div className="flex h-full items-center justify-around">
               <ConcentricRing value={98} label="CACHE" delay={0.8} />
               <ConcentricRing value={100} isBreaker={true} label="NGO_BRK" color={THEME.primary} delay={0.9} />
               <ConcentricRing value={60} isBreaker={true} label="HOS_BRK" color={THEME.critical} delay={1.0} />
             </div>
          </RevealPanel>

          {/* Holographic Escalation Queue */}
          <RevealPanel title="Human-in-Loop Queue" className="flex-1 min-h-0" delay={0.8}>
            <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1 no-scrollbar">
              <AnimatePresence>
                {escalations.map((esc, idx) => (
                  <motion.div 
                    key={esc.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: 1 + (idx*0.2) }}
                    className="border border-[#00e5ff]/30 bg-black/40 p-4 relative group flex-1 flex flex-col justify-center min-h-[120px]"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#00e5ff]/50" />
                    <div className="pl-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-mono text-[#00e5ff] font-bold tracking-wider">{esc.id}</span>
                        <span className="text-[10px] font-mono tracking-widest font-bold uppercase" style={{ color: esc.reason === 'MIXED_CATEGORY' ? THEME.critical : THEME.warning }}>
                          {esc.reason}
                        </span>
                      </div>
                      <div className="text-sm text-[#e0fce9] font-mono leading-relaxed">
                        <ScanlineValue value={`REASON: ${esc.summary}`} delay={1.5 + (idx * 0.1)} />
                      </div>
                      <div className="text-[10px] font-mono text-gray-500 mb-2">
                        PROMPT: {esc.promptVersion}
                      </div>
                      <div className="flex gap-5 text-xs font-mono mt-1">
                        <button 
                           onClick={() => resolveEscalation.mutate({ id: esc.id, decision: 'retry' })}
                           disabled={resolveEscalation.isPending}
                           className="text-[#00ff88] hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <CheckSquare size={14}/> RESOLVE
                        </button>
                        <button 
                           onClick={() => dismissEscalation.mutate({ id: esc.id })}
                           disabled={dismissEscalation.isPending}
                           className="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XSquare size={14}/> DISMISS
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </RevealPanel>

        </div>
      </div>

    </div>
  );
};

export default AdminAgent;
