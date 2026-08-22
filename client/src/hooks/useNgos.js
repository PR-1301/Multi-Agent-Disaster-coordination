import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import apiClient from '../api/client';
import { useSocket } from '../contexts/SocketContext';
import { useMockData } from './useMockData';

export const useNgos = () => {
  const queryClient = useQueryClient();
  const { socket, isConnected, demoMode } = useSocket();
  const mockData = useMockData();

  const { data: ngos = [], isLoading, isError } = useQuery({
    queryKey: ['ngos'],
    queryFn: async () => {
      const res = await apiClient.get('/ngos');
      return res.data;
    },
    enabled: !demoMode,
  });

  const { data: cases = [], isLoading: loadingCases, isError: errorCases } = useQuery({
    queryKey: ['cases'],
    queryFn: async () => {
      const res = await apiClient.get('/cases');
      return res.data;
    },
    enabled: !demoMode,
  });

  const activeCount = ngos.filter(n => n.is_active).length;
  const shelterCapacity = ngos.reduce((sum, n) => sum + (n.shelter_capacity || 0), 0);
  
  const inventory = ngos.map(n => ({
    id: n._id,
    name: n.name,
    isActive: n.is_active,
    shelterCapacity: n.shelter_capacity,
    foodUnits: n.food_units,
    supplyUnits: n.supply_units,
    workload: n.workload || 0,
    reliability: n.reliability_score || 100,
  }));

  const tasks = cases
    .filter(c => (c.status === 'routed' || c.status === 'assigned') && (c.category === 'shelter' || c.category === 'mixed' || c.assigned_facility_type === 'ngo'))
    .map(c => ({
      id: c.case_id?.substring(0, 8) || 'unknown',
      sectorId: c.sector_id || 'unknown',
      resource: c.category === 'shelter' ? 'Shelter Beds' : 'Supplies',
      qty: Math.floor(Math.random() * 5) + 1,
      winner: c.status === 'assigned' ? 'CONFIRMED TARGET' : 'BIDDING...'
    }));
  const logs = [{ id: 'init_ngo', timestamp: Date.now(), text: 'NGO Logistics online. Tracking resources.' }];

  useEffect(() => {
    if (!socket || demoMode) return;

    const handleUpdate = (data) => {
      if (data.event === 'ngo.availability.updated') {
        if (data.payload) {
          queryClient.setQueryData(['ngos'], (old = []) => {
            return old.map(ngo => ngo._id === data.payload._id ? data.payload : ngo);
          });
        } else {
          queryClient.invalidateQueries({ queryKey: ['ngos'] });
        }
      } else if (data.event === 'case.created' || data.event === 'case.routed' || data.event === 'assignment.confirmed' || data.event === 'case.resolved') {
        queryClient.invalidateQueries({ queryKey: ['cases'] });
      }
    };

    socket.on('case-update', handleUpdate);
    return () => socket.off('case-update', handleUpdate);
  }, [socket, queryClient, demoMode]);

  const updateAvailability = useMutation({
    mutationFn: async ({ id, updates }) => {
      const res = await apiClient.post(`/ngos/${id}/availability`, updates);
      return res.data;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['ngos'] });
      const previousNgos = queryClient.getQueryData(['ngos']);
      
      queryClient.setQueryData(['ngos'], (old = []) => {
        return old.map(ngo => ngo._id === id ? { ...ngo, ...updates } : ngo);
      });
      
      return { previousNgos };
    },
    onError: (err, variables, context) => {
      if (context?.previousNgos) {
        queryClient.setQueryData(['ngos'], context.previousNgos);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ngos'] });
    },
  });

  if (demoMode) {
    return {
      data: mockData.ngos,
      isLoading: false,
      isError: false,
      updateAvailability: { mutate: () => {}, isPending: false, error: null },
      isConnected: true,
      isDemo: true
    };
  }

  return {
    data: {
      activeCount,
      shelterCapacity,
      inventory,
      tasks,
      logs
    },
    rawNgos: ngos,
    isLoading: isLoading || loadingCases,
    isError: isError || errorCases,
    updateAvailability,
    isConnected,
    isDemo: false
  };
};
