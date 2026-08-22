import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

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

  return (
    <SocketContext.Provider value={{ socket, isConnected, demoMode, setDemoMode }}>
      {children}
    </SocketContext.Provider>
  );
};
