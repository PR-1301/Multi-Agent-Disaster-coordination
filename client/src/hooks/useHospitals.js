import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import apiClient from '../api/client';
import { useSocket } from '../contexts/SocketContext';
import { useMockData } from './useMockData';

export const useHospitals = () => {
  const queryClient = useQueryClient();
  const { socket, isConnected, demoMode } = useSocket();
  const mockData = useMockData();

  const { data: hospitals = [], isLoading: loadingHospitals, isError: errorHospitals } = useQuery({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const res = await apiClient.get('/hospitals');
      return res.data;
    },
    enabled: !demoMode,
  });

  const availableBeds = hospitals.reduce((sum, h) => sum + (h.bed_count || 0), 0);
  const icuBeds = hospitals.reduce((sum, h) => sum + (h.icu_count || 0), 0);
  const ambulances = hospitals.reduce((sum, h) => sum + (h.ambulance_count || 0), 0);
  
  const facilities = hospitals.map(h => ({
    id: h._id,
    name: h.name,
    bedCount: h.bed_count || 0,
    icuCount: h.icu_count || 0,
    ambulanceCount: h.ambulance_count || 0,
    saturation: h.saturation || 0,
    divert: h.divert || false,
  }));

  const queue = []; // Empty for now, could be fetched from cases assigned to hospitals

  useEffect(() => {
    if (!socket || demoMode) return;

    const handleUpdate = (data) => {
      if (data.event === 'hospital.availability.updated') {
        if (data.payload) {
          queryClient.setQueryData(['hospitals'], (old = []) => {
            return old.map(h => h._id === data.payload._id ? data.payload : h);
          });
        } else {
          queryClient.invalidateQueries({ queryKey: ['hospitals'] });
        }
      }
    };

    socket.on('case-update', handleUpdate);
    return () => socket.off('case-update', handleUpdate);
  }, [socket, queryClient, demoMode]);

  const updateAvailability = useMutation({
    mutationFn: async ({ id, updates }) => {
      const res = await apiClient.post(`/hospitals/${id}/availability`, updates);
      return res.data;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['hospitals'] });
      const previousHospitals = queryClient.getQueryData(['hospitals']);
      
      queryClient.setQueryData(['hospitals'], (old = []) => {
        return old.map(h => h._id === id ? { ...h, ...updates } : h);
      });
      
      return { previousHospitals };
    },
    onError: (err, variables, context) => {
      if (context?.previousHospitals) {
        queryClient.setQueryData(['hospitals'], context.previousHospitals);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
    },
  });

  if (demoMode) {
    return {
      data: mockData.hospitals,
      isLoading: false,
      isError: false,
      updateAvailability: { mutate: () => {}, isPending: false, error: null },
      isConnected: true,
      isDemo: true
    };
  }

  return {
    data: {
      availableBeds,
      icuBeds,
      ambulances,
      facilities,
      queue
    },
    rawHospitals: hospitals,
    isLoading: loadingHospitals,
    isError: errorHospitals,
    updateAvailability,
    isConnected,
    isDemo: false
  };
};
