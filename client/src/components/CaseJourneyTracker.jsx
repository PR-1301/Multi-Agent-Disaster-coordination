import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const STAGES = [
  { id: 'Received', label: 'Received' },
  { id: 'Reviewed', label: 'Reviewed' },
  { id: 'Routed', label: 'Routed' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Resolved', label: 'Resolved' }
];

const CaseJourneyTracker = ({ currentStage, summary, facility, className = "" }) => {
  const currentIndex = STAGES.findIndex(s => s.id === currentStage);
  
  return (
    <div className={`flex flex-col gap-4 font-mono w-full ${className}`}>
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-800 -translate-y-1/2 z-0" />
        
        {/* Active Line */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-[#00ff88] -translate-y-1/2 z-0 transition-all duration-1000 ease-in-out" 
          style={{ width: currentIndex >= 0 ? `${(currentIndex / (STAGES.length - 1)) * 100}%` : '0%', boxShadow: '0 0 10px #00ff88' }} 
        />
        
        {/* Nodes */}
        {STAGES.map((stage, index) => {
          const isCompleted = index <= currentIndex;
          const isActive = index === currentIndex;
          
          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.2 : 1,
                  backgroundColor: isCompleted ? '#00ff88' : '#1f2937',
                  borderColor: isCompleted ? '#00ff88' : '#374151'
                }}
                className={`w-4 h-4 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-500`}
                style={{ boxShadow: isActive ? '0 0 15px #00ff88' : 'none' }}
              >
                {isCompleted ? <CheckCircle2 size={12} className="text-black" /> : null}
              </motion.div>
              <span className={`text-[9px] sm:text-xs absolute top-8 whitespace-nowrap uppercase tracking-widest ${isCompleted ? 'text-[#00ff88] font-bold' : 'text-gray-500'}`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status Details */}
      <div className="mt-8 p-4 bg-black/60 border border-[#00ff88]/30 rounded-sm">
        <div className="text-[#00e5ff] text-sm uppercase tracking-widest mb-1 flex items-center gap-2">
           <ArrowRight size={14} /> Current Status: {currentStage}
        </div>
        
        {facility && (
          <div className="text-gray-300 text-xs mt-2">
            Target Facility: <span className="text-[#00ff88]">{facility}</span>
          </div>
        )}
        
        {summary && (
          <div className="text-white font-medium text-sm mt-3 pt-3 border-t border-white/10">
            {summary}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseJourneyTracker;
