import { useState, useEffect } from 'react';
import { Case, Hospital, NGO, Escalation } from '../types';

const ADMIN_API = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8004';
const HOSPITAL_API = import.meta.env.VITE_HOSPITAL_API_URL || 'http://localhost:8002';
const NGO_API = import.meta.env.VITE_NGO_API_URL || 'http://localhost:8003';

export function useDisasterData() {
  const [cases, setCases] = useState<Case[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);

  const fetchCases = async () => {
    try {
      const res = await fetch(`${ADMIN_API}/cases`);
      const data = await res.json();
      setCases(data.cases || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHospitals = async () => {
    try {
      const res = await fetch(`${HOSPITAL_API}/hospitals`);
      const data = await res.json();
      setHospitals(data.hospitals || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNgos = async () => {
    try {
      const res = await fetch(`${NGO_API}/ngos`);
      const data = await res.json();
      setNgos(data.ngos || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEscalations = async () => {
    try {
      const res = await fetch(`${ADMIN_API}/escalations`);
      const data = await res.json();
      setEscalations(data.escalations || []);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshAll = () => {
    fetchCases();
    fetchHospitals();
    fetchNgos();
    fetchEscalations();
  };

  useEffect(() => {
    refreshAll();

    const eventSource = new EventSource(`${ADMIN_API}/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("SSE Event:", payload.event, payload);
        
        // Naive approach: re-fetch everything on any event to ensure consistency
        // A more optimized approach would update state directly based on payload.event
        refreshAll();
      } catch (err) {
        console.error("Error parsing SSE data", err);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error", error);
      eventSource.close();
      // attempt reconnect after 5s
      setTimeout(refreshAll, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return { cases, hospitals, ngos, escalations, refreshAll, ADMIN_API };
}
