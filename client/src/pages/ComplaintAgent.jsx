import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import HudPanel from '../components/hud/HudPanel';
import AnimatedNumber from '../components/hud/AnimatedNumber';
import TerminalLog from '../components/hud/TerminalLog';
import Gauge from '../components/hud/Gauge';

const THEME = {
  primary: '#ff1744',
  warning: '#ff6b35',
  text: '#ffe5e5',
  critical: '#ff0000'
};

const ComplaintAgent = ({ data }) => {
  const { totalOpen, flagged, feed, volumeTrend, logs } = data;
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const chartData = volumeTrend.map((val, i) => ({ name: i, value: val }));

  return (
    <div className="h-full flex flex-col gap-4 text-[#ffe5e5]" style={{ '--tw-text-opacity': 1 }}>
      {/* Top Bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert size={24} color={THEME.primary} />
          <h1 className="text-2xl font-bold tracking-widest text-[#ff1744]">SIGNAL // INTAKE & TRIAGE</h1>
          <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-[#ff1744]/10 border border-[#ff1744]/30 rounded-full">
             <div className="w-2 h-2 rounded-full bg-[#ff1744] animate-pulse" />
             <span className="text-xs font-mono text-[#ff1744]">LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#ff1744] uppercase tracking-widest">Open Complaints</span>
            <AnimatedNumber value={totalOpen} className="text-2xl text-white" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#ff6b35] uppercase tracking-widest">Flagged for Review</span>
            <AnimatedNumber value={flagged} className="text-2xl text-white" />
          </div>
          <div className="font-mono text-xl text-[#ff1744]/80 tracking-widest bg-black/40 px-4 py-2 border border-[#ff1744]/20">
            {time}
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex gap-2 text-xs font-mono">
        {['ALL SECTORS', 'URGENCY: CRITICAL', 'STATUS: OPEN', 'QUALITY: FLAGGED'].map(f => (
          <button key={f} className="px-3 py-1 border border-[#ff1744]/30 bg-black/40 text-[#ff1744]/70 hover:bg-[#ff1744]/20 hover:text-[#ff1744] transition-colors uppercase">
            {f}
          </button>
        ))}
        <button className="ml-auto px-4 py-1 bg-[#ff1744]/20 border border-[#ff1744] text-[#ff1744] hover:bg-[#ff1744] hover:text-black font-bold uppercase transition-all">
          + Submit Test Complaint
        </button>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Radar */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <HudPanel title="Live Complaint Radar" color={THEME.primary} className="flex-1 min-h-0">
            <div className="relative w-full h-full min-h-[250px] flex items-center justify-center overflow-hidden border border-[#ff1744]/20 rounded-full bg-black/40">
              {/* Radar Rings */}
              {[1, 2, 3].map(i => (
                <div key={i} className="absolute border border-[#ff1744]/20 rounded-full" style={{ width: `${i*30}%`, height: `${i*30}%` }} />
              ))}
              {/* Radar Sweep */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="absolute w-1/2 h-1/2 origin-bottom-right right-1/2 bottom-1/2"
                style={{
                  background: 'conic-gradient(from 180deg at 100% 100%, transparent 0deg, rgba(255,23,68,0.4) 90deg, rgba(255,23,68,0.8) 90deg)',
                  borderRight: `2px solid ${THEME.primary}`
                }}
              />
              {/* Blips */}
              {feed.slice(0,5).map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`absolute w-3 h-3 rounded-full ${c.urgency === 'critical' ? 'bg-[#ff0000] animate-pulse' : 'bg-[#ff1744]/60'}`}
                  style={{
                    top: `${20 + Math.random() * 60}%`,
                    left: `${20 + Math.random() * 60}%`,
                    boxShadow: `0 0 10px ${THEME.primary}`
                  }}
                />
              ))}
            </div>
          </HudPanel>
          
          <HudPanel title="Volume Trend (24H)" color={THEME.primary} className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <Bar dataKey="value" fill={THEME.primary} opacity={0.6} radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </HudPanel>
        </div>

        {/* Center: Feed */}
        <HudPanel title="Ingested Complaints Feed" color={THEME.primary} className="col-span-6" isReceiving={true}>
          <div className="flex flex-col gap-2 h-full overflow-y-auto pr-2">
            <AnimatePresence>
              {feed.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -20, borderColor: '#ffffff' }}
                  animate={{ opacity: 1, y: 0, borderColor: item.urgency === 'critical' ? THEME.critical : 'rgba(255,23,68,0.2)' }}
                  className={`p-3 bg-black/60 border-l-2 ${item.urgency === 'critical' ? 'border-[#ff0000] animate-breathe bg-[#ff0000]/10' : 'border-[#ff1744]/40'} text-sm`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 font-mono text-[#ff1744]">
                      <Phone size={14} /> {item.callerRef} 
                      <span className="text-[10px] px-1 bg-[#ff1744]/20 border border-[#ff1744]/30">{item.lang}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase px-2 py-0.5 ${item.urgency === 'critical' ? 'bg-[#ff0000] text-white animate-pulse' : 'bg-[#ff1744]/20 text-[#ff1744]'}`}>
                        {item.urgency}
                      </span>
                      <span className="text-[10px] font-mono opacity-50">2m ago</span>
                    </div>
                  </div>
                  
                  <div className="text-white font-medium mb-1">{item.originalText}</div>
                  
                  <div className="flex items-center gap-4 mt-3 text-xs font-mono text-gray-400">
                    <div className="flex items-center gap-1"><MapPin size={12} /> {item.sectorId}</div>
                    <div className="flex gap-1 items-center">
                      Score: 
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <div key={s} className={`w-2 h-2 ${s <= item.triageScore ? 'bg-[#ff1744]' : 'border border-[#ff1744]/30'}`} />
                        ))}
                      </div>
                      <span className="ml-1 text-[9px] px-1 border border-gray-600">LLM</span>
                    </div>
                    {item.isDuplicate && (
                       <div className="flex items-center gap-1 text-[#ff6b35]">
                         <XCircle size={12} /> DUP: {item.id.substring(0,6)}
                       </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </HudPanel>

        {/* Right: Telemetry & Actions */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <HudPanel title="Triage Telemetry" color={THEME.primary} className="flex-none">
            <div className="grid grid-cols-2 gap-4">
              <Gauge value={92} label="Confidence" color={THEME.primary} size={90} />
              <Gauge value={12} label="Flagged %" color={THEME.warning} size={90} />
            </div>
            <div className="flex justify-between font-mono text-xs mt-4 pt-4 border-t border-[#ff1744]/20">
              <div>LATENCY: <span className="text-[#ff1744]">124ms</span></div>
              <div>LOAD: <span className="text-[#ff1744]">84%</span></div>
            </div>
          </HudPanel>
          
          <HudPanel title="System Log" color={THEME.primary} className="flex-1 min-h-0">
            <TerminalLog logs={logs} color={THEME.primary} maxLines={10} />
          </HudPanel>

          <div className="grid grid-cols-1 gap-2 mt-auto">
            <button className="h-10 border border-[#ff1744]/50 bg-black/60 hover:bg-[#ff1744]/20 text-[#ff1744] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Approve Flagged
            </button>
            <button className="h-10 border border-[#ff6b35]/50 bg-black/60 hover:bg-[#ff6b35]/20 text-[#ff6b35] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2">
              <XCircle size={16} /> Mark as Spam
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ComplaintAgent;
