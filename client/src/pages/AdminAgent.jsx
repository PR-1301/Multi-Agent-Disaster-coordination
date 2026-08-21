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
// 1. THE NEURAL CORE
// -------------------------------------------------------------
const NeuralCore = () => {
  const svgRef = useRef(null);
  const [pulses, setPulses] = useState([]);

  // Hardcoded exact geometry for Jarvis feel
  const nodes = [
    { id: 0, x: 50, y: 150 }, { id: 1, x: 120, y: 80 }, { id: 2, x: 140, y: 220 },
    { id: 3, x: 220, y: 140 }, { id: 4, x: 280, y: 60 }, { id: 5, x: 300, y: 240 },
    { id: 6, x: 380, y: 150 }, { id: 7, x: 440, y: 90 }, { id: 8, x: 460, y: 200 }
  ];
  const edges = [
    [0,1], [0,2], [1,3], [2,3], [3,4], [3,5], [4,6], [5,6], [6,7], [6,8]
  ];

  useEffect(() => {
    // Fire a precise light pulse randomly every 2-4 seconds
    const interval = setInterval(() => {
      const edge = edges[Math.floor(Math.random() * edges.length)];
      const n1 = nodes[edge[0]];
      const n2 = nodes[edge[1]];
      const id = Date.now();
      setPulses(p => [...p.slice(-4), { id, x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y }]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.05)_0%,transparent_70%)]">
      <svg viewBox="0 0 500 300" className="w-full h-full max-h-[300px]" ref={svgRef}>
        <defs>
          <radialGradient id="nodeGlow">
            <stop offset="0%" stopColor={THEME.secondary} stopOpacity="1"/>
            <stop offset="100%" stopColor={THEME.secondary} stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => (
          <line key={i} x1={nodes[e[0]].x} y1={nodes[e[0]].y} x2={nodes[e[1]].x} y2={nodes[e[1]].y} stroke={THEME.primary} strokeWidth="0.5" strokeOpacity="0.2" />
        ))}

        {/* Nodes */}
        {nodes.map(n => (
          <g key={n.id}>
             <circle cx={n.x} cy={n.y} r={12} fill="none" stroke={THEME.primary} strokeWidth="0.5" strokeOpacity="0.3" />
             <circle cx={n.x} cy={n.y} r={2} fill={THEME.primary} />
          </g>
        ))}

        {/* Traveling Pulses */}
        <AnimatePresence>
          {pulses.map(p => (
            <motion.circle
              key={p.id}
              r={3}
              fill={THEME.secondary}
              style={{ filter: `drop-shadow(0 0 6px ${THEME.secondary})` }}
              initial={{ cx: p.x1, cy: p.y1, opacity: 0 }}
              animate={{ cx: p.x2, cy: p.y2, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.8, ease: "linear" }}
              onAnimationComplete={() => setPulses(curr => curr.filter(x => x.id !== p.id))}
            />
          ))}
        </AnimatePresence>
        
        {/* Decorative Concentric Scanning Ring */}
        <motion.g animate={{ rotate: -360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} style={{ originX: "250px", originY: "150px" }}>
           <circle cx="250" cy="150" r="140" fill="none" stroke={THEME.primary} strokeWidth="0.5" strokeOpacity="0.1" strokeDasharray="2 10" />
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
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 scrollbar-thin">
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
const AdminAgent = ({ data }) => {
  const { health, kanban, escalations, logs } = data;
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

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
          <RevealPanel title="Agent Network Topology" className="flex-none h-64" delay={0.2}>
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
            <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
              <AnimatePresence>
                {escalations.map((esc, idx) => (
                  <motion.div 
                    key={esc.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 1.2 + (idx * 0.1) }}
                    className="p-2 border border-[#00e5ff]/20 bg-[linear-gradient(90deg,rgba(0,229,255,0.05)_0%,transparent_100%)] font-mono text-[10px]"
                  >
                    <div className="flex justify-between items-center mb-2 border-b border-[#00e5ff]/10 pb-1">
                      <span className="text-[#00e5ff] tracking-widest">{esc.id}</span>
                      <span className="text-[#ffc107] opacity-80 uppercase">{esc.reason}</span>
                    </div>
                    
                    <div className="text-gray-400 mb-2 leading-tight">
                      <ScanlineValue value={`REASON: ${esc.summary}`} delay={1.5 + (idx * 0.1)} />
                      <div className="mt-1 opacity-50">PROMPT: {esc.promptVersion}</div>
                    </div>

                    <div className="flex gap-4">
                      <button className="text-[#00ff88] hover:text-white transition-colors flex items-center gap-1">
                        <CheckSquare size={10} /> RESOLVE
                      </button>
                      <button className="text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                        <XSquare size={10} /> DISMISS
                      </button>
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
