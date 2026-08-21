import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TerminalLog = ({ logs, color = '#00ff88', maxLines = 15 }) => {
  const containerRef = useRef(null);
  const [displayedLogs, setDisplayedLogs] = useState([]);

  useEffect(() => {
    // Keep only the last maxLines logs
    setDisplayedLogs(logs.slice(-maxLines));
  }, [logs, maxLines]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedLogs]);

  return (
    <div 
      ref={containerRef}
      className="bg-black/80 border border-gray-800 p-3 h-full overflow-y-auto font-mono text-sm shadow-inner"
      style={{ scrollBehavior: 'smooth' }}
    >
      <AnimatePresence initial={false}>
        {displayedLogs.map((log) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-1 leading-relaxed break-words whitespace-pre-wrap"
            style={{ color: log.isError ? '#ff1744' : log.isWarning ? '#ffc107' : color }}
          >
            <span className="opacity-50 mr-2">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span className="opacity-75 mr-2">{`>`}</span>
            {log.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default TerminalLog;
