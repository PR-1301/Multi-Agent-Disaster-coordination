import React from 'react';
import { motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber';

const Gauge = ({ value, max = 100, label, color = '#00ff88', size = 120, unit = '%' }) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const strokeDashoffset = circumference - percentage * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, type: 'spring', bounce: 0 }}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      
      <div className="absolute flex flex-col items-center justify-center text-center">
        <div className="text-xl font-bold font-mono" style={{ color }}>
          <AnimatedNumber value={value} />{unit}
        </div>
        {label && <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1 max-w-[80px] leading-tight">{label}</div>}
      </div>
    </div>
  );
};

export default Gauge;
