import React from 'react';
import { motion } from 'framer-motion';

const HudPanel = ({ title, children, color = '#00e5ff', className = '', isReceiving = false, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
      className={`hud-panel flex flex-col p-4 ${className}`}
      style={{ color: color }}
    >
      <div className="hud-panel-inner" style={{ color: color }} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 relative">
        <h2 className="text-lg font-bold tracking-widest text-white">{title}</h2>
        {isReceiving && (
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
          />
        )}
        
        {/* Animated Sweep Underline */}
        <motion.div 
          className="absolute bottom-0 left-0 h-[1px]"
          style={{ backgroundColor: color }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.5, delay: delay + 0.2, ease: 'easeInOut' }}
        />
        <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gray-800" />
      </div>
      
      {/* Content */}
      <div className="flex-1 text-gray-200 min-h-0 flex flex-col relative">
        {children}
      </div>
    </motion.div>
  );
};

export default HudPanel;
