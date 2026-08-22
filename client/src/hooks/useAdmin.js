import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import apiClient from '../api/client';
import { useSocket } from '../contexts/SocketContext';
import { useMockData } from './useMockData';

export const useAdmin = () => {
  const queryClient = useQueryClient();
  const { socket, isConnected, demoMode } = useSocket();
  const mockData = useMockData();

  const { data: healthData, isLoading: loadingHealth, isError: errorHealth } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/health');
      return res.data;
    },
    enabled: !demoMode,
    refetchInterval: 5000,
  });

  const { data: cases = [], isLoading: loadingCases, isError: errorCases } = useQuery({
    queryKey: ['cases'],
    queryFn: async () => {
      const res = await apiClient.get('/cases');
      return res.data;
    },
    enabled: !demoMode,
  });

  const { data: escalations = [], isLoading: loadingEscalations, isError: errorEscalations } = useQuery({
    queryKey: ['escalations'],
    queryFn: async () => {
      const res = await apiClient.get('/escalations');
      return res.data;
    },
    enabled: !demoMode,
  });

  // Calculate Kanban
  const kanban = {
    intake: cases.filter(c => c.status === 'intake').map(c => c.case_id?.substring(0, 8) || 'unknown'),
    routed: cases.filter(c => c.status === 'routed').map(c => c.case_id?.substring(0, 8) || 'unknown'),
    assigned: cases.filter(c => c.status === 'assigned').map(c => c.case_id?.substring(0, 8) || 'unknown'),
    resolved: cases.filter(c => c.status === 'resolved' || c.status === 'closed').map(c => c.case_id?.substring(0, 8) || 'unknown'),
    escalated: cases.filter(c => c.status === 'escalated').map(c => c.case_id?.substring(0, 8) || 'unknown'),
  };

  const health = healthData?.circuitBreaker?.state === 'OPEN' ? 'CRITICAL' : (healthData?.queueDepth > 10 ? 'DEGRADED' : 'HEALTHY');
  
  const formattedEscalations = escalations.map(e => ({
    id: e._id,
    reason: e.reason_taxonomy || e.reason,
    summary: e.reason,
    promptVersion: e.prompt_version || 'v1',
    resolved: e.resolved
  }));

  const logs = [{ id: 'init_admin', timestamp: Date.now(), text: 'NEXUS central command active.' }];

  useEffect(() => {
    if (!socket || demoMode) return;

    const handleUpdate = (data) => {
      if (data.event === 'case.created' || data.event === 'case.routed' || data.event === 'assignment.confirmed' || data.event === 'case.resolved' || data.event === 'escalation.raised') {
        if (data.payload && (data.event === 'case.created' || data.event === 'case.routed' || data.event === 'assignment.confirmed' || data.event === 'case.resolved')) {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
        } else {
            queryClient.invalidateQueries({ queryKey: ['cases'] });
        }
        
        if (data.event === 'escalation.raised' || data.event === 'escalation.resolved') {
            queryClient.invalidateQueries({ queryKey: ['escalations'] });
        }
      }
    };

    const handleAdminAlert = (data) => {
       queryClient.invalidateQueries({ queryKey: ['admin', 'health'] });
    };

    socket.on('case-update', handleUpdate);
    socket.on('admin-alert', handleAdminAlert);
    
    return () => {
      socket.off('case-update', handleUpdate);
      socket.off('admin-alert', handleAdminAlert);
    };
  }, [socket, queryClient, demoMode]);

  const resolveEscalation = useMutation({
    mutationFn: async ({ id, decision }) => {
      const res = await apiClient.post(`/escalations/${id}/resolve`, { decision, notes: 'Resolved from HUD' });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });

  const dismissEscalation = useMutation({
    mutationFn: async ({ id }) => {
       // Since there's no dismiss, we'll map dismiss to resolve with 'retry' or similar.
       // Looking at backend, choices are ['hospital', 'ngo', 'reject', 'retry']
       const res = await apiClient.post(`/escalations/${id}/resolve`, { decision: 'reject', notes: 'Dismissed from HUD' });
       return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    }
  });


  if (demoMode) {
    return {
      data: mockData.admin,
      isLoading: false,
      isError: false,
      resolveEscalation: { mutate: () => {}, isPending: false, error: null },
      dismissEscalation: { mutate: () => {}, isPending: false, error: null },
      isConnected: true,
      isDemo: true
    };
  }

  return {
    data: {
      health,
      kanban,
      escalations: formattedEscalations,
      logs
    },
    isLoading: loadingHealth || loadingCases || loadingEscalations,
    isError: errorHealth || errorCases || errorEscalations,
    resolveEscalation,
    dismissEscalation,
    isConnected,
    isDemo: false
  };
};
