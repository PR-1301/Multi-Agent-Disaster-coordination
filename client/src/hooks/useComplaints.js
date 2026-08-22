import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import apiClient from '../api/client';
import { useSocket } from '../contexts/SocketContext';
import { useMockData } from './useMockData';

export const useComplaints = () => {
  const queryClient = useQueryClient();
  const { socket, isConnected, demoMode } = useSocket();
  const mockData = useMockData();

  const { data: flagged = [], isLoading: loadingFlagged, isError: errorFlagged } = useQuery({
    queryKey: ['complaints', 'flagged'],
    queryFn: async () => {
      const res = await apiClient.get('/complaints/flagged');
      return res.data;
    },
    enabled: !demoMode,
  });

  const { data: recentCases = [], isLoading: loadingCases, isError: errorCases } = useQuery({
    queryKey: ['cases'],
    queryFn: async () => {
      const res = await apiClient.get('/cases');
      return res.data;
    },
    enabled: !demoMode,
  });

  // Derived stats
  const totalOpen = recentCases.filter(c => c.status !== 'closed' && c.status !== 'resolved').length;
  const feed = recentCases.map(c => ({
    id: c.case_id,
    callerRef: c.extracted_signals?.caller_id || c.case_id,
    channel: 'call',
    originalText: c.description || '',
    lang: 'ENG',
    sectorId: c.sector_id,
    urgency: c.urgency,
    triageScore: c.priority_score || 0,
    source: 'llm',
    isDuplicate: false,
    status: c.status,
    location: c.location || null
  }));
  // Mock trend and logs for now as there's no endpoint for them
  const volumeTrend = [40, 30, 45, 60, 80, 50, 90, 110, 80, 95, 130, 142];
  const logs = [{ id: 'init', timestamp: Date.now(), text: 'System initialized. Listening for signals...' }];

  useEffect(() => {
    if (!socket || demoMode) return;

    const handleUpdate = (data) => {
      if (data.event === 'case.created' || data.event === 'complaint.distress_flagged') {
        // Optimistically update cache if payload is present
        if (data.payload) {
          queryClient.setQueryData(['cases'], (old = []) => [data.payload, ...old]);
        } else {
          queryClient.invalidateQueries({ queryKey: ['cases'] });
        }
      }
    };

    socket.on('case-update', handleUpdate);
    return () => socket.off('case-update', handleUpdate);
  }, [socket, queryClient, demoMode]);

  const submitComplaint = useMutation({
    mutationFn: async (payload) => {
      const res = await apiClient.post('/complaints', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });

  const approveFlagged = useMutation({
    mutationFn: async (complaintId) => {
      const res = await apiClient.post(`/complaints/${complaintId}/clear-flag`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints', 'flagged'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });

  if (demoMode) {
    return {
      data: mockData.complaints,
      isLoading: false,
      isError: false,
      submitComplaint: { mutate: mockData.addTestComplaint, isPending: false, error: null },
      approveFlagged: { mutate: () => {}, isPending: false, error: null },
      isConnected: true,
      isDemo: true
    };
  }

  return {
    data: {
      totalOpen,
      flagged: flagged.length,
      feed,
      volumeTrend,
      logs
    },
    rawFlagged: flagged,
    isLoading: loadingFlagged || loadingCases,
    isError: errorFlagged || errorCases,
    submitComplaint,
    approveFlagged,
    isConnected,
    isDemo: false
  };
};
