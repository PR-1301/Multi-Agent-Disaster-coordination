import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ShieldAlert, Users, PlusSquare, Network } from 'lucide-react';
import { motion } from 'framer-motion';

const AGENTS = [
  { path: '/complaint', name: 'SIGNAL', icon: ShieldAlert, color: '#ff1744', desc: 'Intake & Triage' },
  { path: '/ngo', name: 'RELIEF', icon: Users, color: '#ffc107', desc: 'Logistics' },
  { path: '/hospital', name: 'TRIAGE', icon: PlusSquare, color: '#00e5ff', desc: 'Medical Command' },
  { path: '/admin', name: 'NEXUS', icon: Network, color: '#00ff88', desc: 'System Oversight' }
];

const HudLayout = ({ children }) => {
  const location = useLocation();

  return (
    <div className="relative min-h-screen bg-[#080808] text-gray-200 flex flex-col font-sans">
      {/* Ambient scan lines */}
      <div className="absolute inset-0 pointer-events-none hud-bg-scanlines opacity-40 z-0" />
      <motion.div 
        className="absolute left-0 right-0 h-32 bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-10"
        style={{ animation: 'scanline 8s linear infinite' }}
      />

      {/* Top Nav */}
      <header className="relative z-20 border-b border-gray-800 bg-black/50 backdrop-blur-md px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-gray-900 flex items-center justify-center border border-gray-700">
            <Network size={20} className="text-[#00ff88]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-widest leading-none text-white">CYBER-HUD</h1>
            <div className="text-[9px] sm:text-[10px] text-gray-400 font-mono tracking-widest mt-0.5">MULTI-AGENT DISASTER COORDINATION</div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-1 sm:gap-2">
          {AGENTS.map((agent) => {
            const isActive = location.pathname === agent.path || (location.pathname === '/' && agent.path === '/complaint');
            const Icon = agent.icon;
            return (
              <NavLink 
                key={agent.path}
                to={agent.path}
                className={`relative px-3 sm:px-4 py-2 flex items-center gap-2.5 transition-all duration-300 rounded-xs ${isActive ? 'bg-black/80' : 'hover:bg-gray-900/60'}`}
                style={{
                  borderBottom: isActive ? `2px solid ${agent.color}` : '2px solid transparent',
                  color: isActive ? agent.color : '#999'
                }}
              >
                <Icon size={17} />
                <div className="flex flex-col text-left">
                  <span className="font-bold text-xs sm:text-sm tracking-widest leading-none">{agent.name}</span>
                  {isActive && <span className="text-[9px] text-gray-400 font-mono hidden md:block mt-1">{agent.desc}</span>}
                </div>
                {isActive && (
                  <motion.div 
                    layoutId="active-nav-glow"
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      boxShadow: `inset 0 -12px 12px -12px ${agent.color}`,
                      opacity: 0.6
                    }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col p-3 sm:p-5 lg:p-6 overflow-y-auto">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto min-h-0"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default HudLayout;
