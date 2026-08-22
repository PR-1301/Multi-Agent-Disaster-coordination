import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Navigation2 } from 'lucide-react';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [demoMode, setDemoMode] = useState(false); // Global DEMO MODE flag

  useEffect(() => {
    if (demoMode) {
      if (socket) {
        socket.disconnect();
      }
      setIsConnected(false);
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const newSocket = io(socketUrl, {
      reconnectionDelayMax: 10000,
      auth: {
        token: localStorage.getItem('auth_token') || 'mock_token_123'
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, [demoMode]);

  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    if (!socket || demoMode) return;
    
    const handleUpdate = (data) => {
      if (data.event === 'case.created') addToast(`New Case Created: ${data.case_id}`, 'info');
      else if (data.event === 'case.routed') addToast(`Case ${data.case_id} routed to ${data.payload.target}`, 'routing');
      else if (data.event === 'assignment.confirmed') addToast(`Case ${data.case_id} assigned to ${data.payload.facility_name}`, 'success');
      else if (data.event === 'case.resolved') addToast(`Case ${data.case_id} resolved!`, 'success');
    };
    
    socket.on('case-update', handleUpdate);
    return () => socket.off('case-update', handleUpdate);
  }, [socket, demoMode]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, demoMode, setDemoMode, addToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-3 rounded border font-mono text-xs flex items-center gap-3 shadow-lg min-w-[250px] bg-black/90
                ${toast.type === 'success' ? 'border-[#00ff88] text-[#00ff88]' : 
                  toast.type === 'routing' ? 'border-[#00e5ff] text-[#00e5ff]' : 
                  'border-[#ff1744] text-[#ff1744]'}`}
            >
              {toast.type === 'success' ? <CheckCircle2 size={16} /> : 
               toast.type === 'routing' ? <Navigation2 size={16} /> : 
               <AlertCircle size={16} />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </SocketContext.Provider>
  );
};
