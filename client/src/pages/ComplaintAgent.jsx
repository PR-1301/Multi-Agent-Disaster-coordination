import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, ShieldAlert, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import HudPanel from '../components/hud/HudPanel';
import AnimatedNumber from '../components/hud/AnimatedNumber';
import TerminalLog from '../components/hud/TerminalLog';
import Gauge from '../components/hud/Gauge';
import { useComplaints } from '../hooks/useComplaints';

const THEME = {
  primary: '#ff1744',
  warning: '#ff6b35',
  text: '#ffe5e5',
  critical: '#ff0000'
};

const ComplaintAgent = () => {
  const { data, rawFlagged, isLoading, isError, submitComplaint, approveFlagged, isConnected, isDemo } = useComplaints();
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { totalOpen = 0, flagged = 0, feed = [], volumeTrend = [], logs = [] } = data || {};
  const chartData = volumeTrend.map((val, i) => ({ name: i, value: val }));

  const handleTestSubmit = () => {
    submitComplaint.mutate({
      sector_id: `S-${Math.floor(Math.random() * 20) + 1}`,
      caller_ref: `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`,
      description: 'Test complaint generated from HUD.',
      urgency: Math.random() > 0.8 ? 'critical' : 'high',
      location: { lat: 28.6139 + (Math.random() * 0.1 - 0.05), lng: 77.2090 + (Math.random() * 0.1 - 0.05) },
      source_command_center: 'HUD_MANUAL'
    });
  };

  const handleApprove = () => {
    if (rawFlagged && rawFlagged.length > 0) {
      approveFlagged.mutate(rawFlagged[0]._id);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-[#ff1744] font-mono">
        <ShieldAlert size={48} className="animate-pulse opacity-50" />
        <div className="text-xl tracking-[0.2em] animate-pulse">ESTABLISHING UPLINK...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-[#ff0000] font-mono">
        <AlertTriangle size={48} className="animate-pulse" />
        <div className="text-xl tracking-[0.2em] font-bold">SIGNAL LOST — RETRYING</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 text-[#ffe5e5]" style={{ '--tw-text-opacity': 1 }}>
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldAlert size={24} color={THEME.primary} />
          <h1 className="text-xl sm:text-2xl font-bold tracking-widest text-[#ff1744]">SIGNAL // INTAKE & TRIAGE</h1>
          <div className={`flex items-center gap-2 px-3 py-1 border rounded-full ${isConnected ? 'bg-[#ff1744]/10 border-[#ff1744]/30' : 'bg-gray-800/80 border-gray-600'}`}>
             <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#ff1744] animate-pulse' : 'bg-gray-400'}`} />
             <span className={`text-xs font-mono ${isConnected ? 'text-[#ff1744]' : 'text-gray-400'}`}>
               {isDemo ? 'DEMO MODE' : (isConnected ? 'LIVE' : 'RECONNECTING...')}
             </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#ff1744] uppercase tracking-widest">Open Complaints</span>
            <AnimatedNumber value={totalOpen} className="text-xl sm:text-2xl text-white font-bold" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#ff6b35] uppercase tracking-widest">Flagged for Review</span>
            <AnimatedNumber value={flagged} className="text-xl sm:text-2xl text-white font-bold" />
          </div>
          <div className="font-mono text-lg sm:text-xl text-[#ff1744]/80 tracking-widest bg-black/40 px-3 py-1.5 border border-[#ff1744]/20">
            {time}
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex flex-wrap gap-2">
          {['ALL SECTORS', 'URGENCY: CRITICAL', 'STATUS: OPEN', 'QUALITY: FLAGGED'].map(f => (
            <button key={f} className="px-3 py-1 border border-[#ff1744]/30 bg-black/40 text-[#ff1744]/80 hover:bg-[#ff1744]/20 hover:text-[#ff1744] transition-colors uppercase rounded-sm">
              {f}
            </button>
          ))}
        </div>
        <button 
          onClick={handleTestSubmit}
          disabled={submitComplaint.isPending}
          className="px-4 py-1.5 bg-[#ff1744]/20 border border-[#ff1744] text-[#ff1744] hover:bg-[#ff1744] hover:text-black font-bold uppercase transition-all rounded-sm cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitComplaint.isPending ? 'TRANSMITTING...' : '+ Submit Test Complaint'}
        </button>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        
        {/* Left: Radar */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <HudPanel title="Live Complaint Radar" color={THEME.primary} className="flex-1 min-h-[260px]">
            <div className="relative w-full h-full min-h-[200px] flex items-center justify-center overflow-hidden border border-[#ff1744]/20 rounded-full bg-black/40 p-4">
              {/* Radar Rings (Oval to fit container) */}
              {[1, 2, 3].map(i => (
                <div key={i} className="absolute border border-[#ff1744]/20 rounded-full" style={{ width: `${i*33}%`, height: `${i*33}%` }} />
              ))}
              
              {/* Radar Sweep (Perfect Circle, overflowing to cover the pill container) */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="absolute aspect-square rounded-full pointer-events-none"
                style={{
                  width: '150%',
                  background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,23,68,0.1) 270deg, rgba(255,23,68,0.8) 360deg)',
                  borderTop: `2px solid ${THEME.primary}`
                }}
              />
              
              {/* Blips */}
              {feed.slice(0, 10).map((c) => {
                const hash = c.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const top = c.location?.lat ? ((c.location.lat * 100) % 80) + 10 : (hash % 80) + 10;
                const left = c.location?.lng ? ((c.location.lng * 100) % 80) + 10 : ((hash * 7) % 80) + 10;
                
                return (
                  <motion.div
                    key={c.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`absolute w-3 h-3 rounded-full ${c.urgency === 'critical' ? 'bg-[#ff0000] animate-pulse' : 'bg-[#ff1744]/60'}`}
                    style={{
                      top: `${top}%`,
                      left: `${left}%`,
                      boxShadow: `0 0 10px ${THEME.primary}`
                    }}
                  />
                );
              })}
            </div>
          </HudPanel>
          
          <HudPanel title="Volume Trend (24H)" color={THEME.primary} className="h-40 flex-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <Bar dataKey="value" fill={THEME.primary} opacity={0.6} radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </HudPanel>
        </div>

        {/* Center: Feed */}
        <HudPanel title="Ingested Complaints Feed" color={THEME.primary} className="lg:col-span-6 min-h-[350px]" isReceiving={true}>
          <div className="flex flex-col gap-2.5 h-full overflow-y-auto pr-1">
            <AnimatePresence>
              {feed.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -20, borderColor: '#ffffff' }}
                  animate={{ opacity: 1, y: 0, borderColor: item.urgency === 'critical' ? THEME.critical : 'rgba(255,23,68,0.25)' }}
                  className={`p-3.5 bg-black/70 border-l-4 rounded-r-sm ${item.urgency === 'critical' ? 'border-[#ff0000] bg-[#ff0000]/10' : 'border-[#ff1744]/50'} text-sm transition-all`}
                >
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <div className="flex items-center gap-2 font-mono text-[#ff1744] font-semibold">
                      <Phone size={15} /> 
                      <span className="tracking-wide text-white">{item.callerRef}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#ff1744]/20 border border-[#ff1744]/40 text-[#ff1744] rounded">{item.lang}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded uppercase">{item.channel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${item.urgency === 'critical' ? 'bg-[#ff0000] text-white animate-pulse' : 'bg-[#ff1744]/20 text-[#ff1744] border border-[#ff1744]/30'}`}>
                        {item.urgency}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">2m ago</span>
                    </div>
                  </div>
                  
                  <div className="text-gray-100 font-medium mb-2 leading-snug">{item.originalText}</div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs font-mono text-gray-400 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-gray-300"><MapPin size={13} className="text-[#ff1744]" /> {item.sectorId}</div>
                    <div className="flex gap-1.5 items-center">
                      <span className="text-gray-400">Score:</span> 
                      <div className="flex gap-0.5 items-center">
                        {[1,2,3,4,5].map(s => (
                          <div key={s} className={`w-2 h-2 rounded-xs ${s <= item.triageScore ? 'bg-[#ff1744]' : 'border border-[#ff1744]/30'}`} />
                        ))}
                      </div>
                      <span className="ml-1 text-[9px] px-1 py-0.2 border border-gray-700 text-gray-400 rounded">LLM</span>
                    </div>
                    {item.isDuplicate && (
                       <div className="flex items-center gap-1 text-[#ff6b35] font-semibold">
                         <XCircle size={13} /> DUP: {item.id.substring(0,6)}
                       </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </HudPanel>

        {/* Right: Telemetry & Actions */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <HudPanel title="Triage Telemetry" color={THEME.primary} className="flex-none">
            <div className="grid grid-cols-2 gap-2 place-items-center">
              <Gauge value={92} label="Confidence" color={THEME.primary} size={85} />
              <Gauge value={12} label="Flagged %" color={THEME.warning} size={85} />
            </div>
            <div className="flex justify-between font-mono text-xs mt-3 pt-3 border-t border-[#ff1744]/20">
              <div>LATENCY: <span className="text-[#ff1744]">124ms</span></div>
              <div>LOAD: <span className="text-[#ff1744]">84%</span></div>
            </div>
          </HudPanel>
          
          <HudPanel title="System Log" color={THEME.primary} className="flex-1 min-h-[140px]">
            <TerminalLog logs={logs} color={THEME.primary} maxLines={10} />
          </HudPanel>

          <div className="flex flex-col gap-2 mt-auto">
            <button 
              onClick={handleApprove}
              disabled={approveFlagged.isPending || !rawFlagged || rawFlagged.length === 0}
              className="py-2.5 border border-[#ff1744]/50 bg-black/60 hover:bg-[#ff1744]/20 text-[#ff1744] font-bold tracking-widest uppercase transition-all rounded flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={16} /> {approveFlagged.isPending ? 'PROCESSING...' : 'Approve Flagged'}
            </button>
            <button className="py-2.5 border border-[#ff6b35]/50 bg-black/60 hover:bg-[#ff6b35]/20 text-[#ff6b35] font-bold tracking-widest uppercase transition-all rounded flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer">
              <XCircle size={16} /> Mark as Spam
            </button>
            {approveFlagged.isError && <div className="text-[#ff0000] text-[10px] text-center font-mono">ACTION FAILED</div>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ComplaintAgent;
