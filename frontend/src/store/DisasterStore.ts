import { create } from 'zustand';
import { Case, Hospital, NGO, Escalation } from '../types';

interface DisasterState {
  cases: Case[];
  hospitals: Hospital[];
  ngos: NGO[];
  escalations: Escalation[];
  
  addCase: (c: Case) => void;
  updateCase: (id: string, updates: Partial<Case>) => void;
  addEscalation: (e: Escalation) => void;
  updateEscalation: (id: string, updates: Partial<Escalation>) => void;
  updateHospitalCapacity: (id: string, bed_count: number) => void;
  updateNGOCapacity: (id: string, shelter_capacity: number) => void;
  setHospitals: (hospitals: Hospital[]) => void;
  setNGOs: (ngos: NGO[]) => void;
}

export const useDisasterStore = create<DisasterState>((set) => ({
  cases: [],
  hospitals: [],
  ngos: [],
  escalations: [],

  addCase: (c) => set((state) => ({ cases: [c, ...state.cases] })),
  updateCase: (id, updates) => set((state) => ({
    cases: state.cases.map(c => c.id === id ? { ...c, ...updates } : c)
  })),
  addEscalation: (e) => set((state) => ({ escalations: [e, ...state.escalations] })),
  updateEscalation: (id, updates) => set((state) => ({
    escalations: state.escalations.map(e => e.id === id ? { ...e, ...updates } : e)
  })),
  updateHospitalCapacity: (id, bed_count) => set((state) => ({
    hospitals: state.hospitals.map(h => h.id === id ? { ...h, bed_count } : h)
  })),
  updateNGOCapacity: (id, shelter_capacity) => set((state) => ({
    ngos: state.ngos.map(n => n.id === id ? { ...n, shelter_capacity } : n)
  })),
  setHospitals: (hospitals) => set({ hospitals }),
  setNGOs: (ngos) => set({ ngos })
}));
