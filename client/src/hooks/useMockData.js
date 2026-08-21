import { useState, useEffect } from 'react';

// Generates an initial state and pushes updates periodically
export const useMockData = () => {
  // Complaint Data
  const [complaints, setComplaints] = useState({
    totalOpen: 142,
    flagged: 12,
    feed: Array.from({ length: 5 }).map((_, i) => createMockComplaint(i)),
    volumeTrend: [40, 30, 45, 60, 80, 50, 90, 110, 80, 95, 130, 142],
    logs: [{ id: 'init', timestamp: Date.now(), text: 'System initialized. Listening for signals...' }]
  });

  // NGO Data
  const [ngos, setNgos] = useState({
    activeCount: 18,
    shelterCapacity: 450,
    inventory: Array.from({ length: 4 }).map((_, i) => createMockNgo(i)),
    tasks: Array.from({ length: 3 }).map((_, i) => createMockNgoTask(i)),
    logs: [{ id: 'init_ngo', timestamp: Date.now(), text: 'NGO Logistics online. Tracking resources.' }]
  });

  // Hospital Data
  const [hospitals, setHospitals] = useState({
    availableBeds: 215,
    icuBeds: 45,
    ambulances: 32,
    facilities: Array.from({ length: 5 }).map((_, i) => createMockHospital(i)),
    queue: Array.from({ length: 4 }).map((_, i) => createMockHospitalCase(i))
  });

  // Admin Data
  const [admin, setAdmin] = useState({
    health: 'HEALTHY', // HEALTHY, DEGRADED, CRITICAL
    kanban: {
      intake: [1,2,3],
      routed: [4,5],
      assigned: [6,7,8,9],
      resolved: [10,11],
      escalated: [12]
    },
    escalations: Array.from({ length: 3 }).map((_, i) => createMockEscalation(i)),
    logs: [{ id: 'init_admin', timestamp: Date.now(), text: 'NEXUS central command active.' }]
  });

  useEffect(() => {
    // Simulate real-time updates every 3 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Update Complaints
      setComplaints(prev => {
        const isNewComplaint = Math.random() > 0.5;
        const newFeed = isNewComplaint 
          ? [createMockComplaint(now), ...prev.feed].slice(0, 15)
          : [...prev.feed];
        
        // Randomly modify a complaint's status to simulate activity
        if (!isNewComplaint && newFeed.length > 0) {
          const idx = Math.floor(Math.random() * newFeed.length);
          newFeed[idx] = { ...newFeed[idx], urgency: Math.random() > 0.8 ? 'critical' : newFeed[idx].urgency };
        }

        return {
          ...prev,
          totalOpen: prev.totalOpen + (isNewComplaint ? 1 : Math.random() > 0.7 ? -1 : 0),
          feed: newFeed,
          logs: isNewComplaint 
            ? [...prev.logs, { id: now, timestamp: now, text: `[TRIAGE] New signal detected sector_${Math.floor(Math.random() * 9)}` }].slice(-15)
            : prev.logs
        };
      });

      // Update NGOs
      setNgos(prev => {
        const isTaskAssigned = Math.random() > 0.6;
        let newInventory = [...prev.inventory];
        let newTasks = [...prev.tasks];
        
        if (isTaskAssigned) {
          // Drain resources from random NGO
          const ngoIdx = Math.floor(Math.random() * newInventory.length);
          newInventory[ngoIdx] = {
            ...newInventory[ngoIdx],
            foodUnits: Math.max(0, newInventory[ngoIdx].foodUnits - Math.floor(Math.random() * 20)),
            workload: newInventory[ngoIdx].workload + 1
          };
          
          newTasks = [{
            id: `case_${Math.floor(Math.random()*1000)}`,
            sectorId: `SEC-${Math.floor(Math.random()*9)}`,
            resource: 'Food/Water',
            qty: 50,
            winner: newInventory[ngoIdx].name,
            timestamp: now
          }, ...prev.tasks].slice(0, 8);
        }

        return {
          ...prev,
          inventory: newInventory,
          tasks: newTasks,
          logs: isTaskAssigned 
            ? [...prev.logs, { id: now, timestamp: now, text: `[DISPATCH] Resource deduction confirmed -> ${newTasks[0].id}` }].slice(-15)
            : prev.logs
        };
      });

      // Update Hospitals
      setHospitals(prev => {
        let newFacilities = [...prev.facilities];
        const hIdx = Math.floor(Math.random() * newFacilities.length);
        
        // Random bed fluctuations
        const change = Math.random() > 0.5 ? 1 : -1;
        newFacilities[hIdx] = {
          ...newFacilities[hIdx],
          bedCount: Math.max(0, newFacilities[hIdx].bedCount + change),
          saturation: Math.min(100, Math.max(0, newFacilities[hIdx].saturation + (change > 0 ? -2 : 2)))
        };

        const isNewCase = Math.random() > 0.7;
        const newQueue = isNewCase
          ? [createMockHospitalCase(now), ...prev.queue].slice(0, 10)
          : [...prev.queue];

        if (!isNewCase && newQueue.length > 0 && Math.random() > 0.5) {
           const qIdx = Math.floor(Math.random() * newQueue.length);
           if (newQueue[qIdx].status === 'pending') {
               newQueue[qIdx] = { ...newQueue[qIdx], status: Math.random() > 0.2 ? 'confirmed' : 'failed' };
           }
        }

        return {
          ...prev,
          facilities: newFacilities,
          queue: newQueue,
          availableBeds: prev.availableBeds + change
        };
      });

    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return { complaints, ngos, hospitals, admin };
};


// Helpers
const createMockComplaint = (id) => {
  const urgencies = ['low', 'medium', 'high', 'critical'];
  const sources = ['llm', 'heuristic', 'manual'];
  return {
    id: `C-${id}-${Math.floor(Math.random() * 1000)}`,
    callerRef: `+91 98${Math.floor(Math.random() * 10000000)}`,
    channel: Math.random() > 0.5 ? 'whatsapp' : 'call',
    originalText: 'Need help urgently, water is rising.',
    lang: Math.random() > 0.5 ? 'ENG' : 'HIN',
    sectorId: `S-${Math.floor(Math.random() * 20)}`,
    urgency: urgencies[Math.floor(Math.random() * urgencies.length)],
    triageScore: Math.floor(Math.random() * 5) + 1,
    source: sources[Math.floor(Math.random() * sources.length)],
    isDuplicate: Math.random() > 0.8,
    status: Math.random() > 0.2 ? 'open' : 'flagged_for_review',
    createdAt: Date.now() - Math.floor(Math.random() * 600000)
  };
};

const createMockNgo = (id) => ({
  id: `NGO-${id}`,
  name: `ReliefOrg_${id}`,
  isActive: Math.random() > 0.2,
  shelterCapacity: Math.floor(Math.random() * 100) + 20,
  foodUnits: Math.floor(Math.random() * 500) + 100,
  supplyUnits: Math.floor(Math.random() * 300) + 50,
  workload: Math.floor(Math.random() * 10),
  reliability: Math.floor(Math.random() * 20) + 80
});

const createMockNgoTask = (id) => ({
  id: `task_${id}`,
  sectorId: `S-${Math.floor(Math.random() * 20)}`,
  resource: Math.random() > 0.5 ? 'Food/Water' : 'Shelter',
  qty: Math.floor(Math.random() * 50) + 10,
  winner: `ReliefOrg_${Math.floor(Math.random() * 4)}`,
  timestamp: Date.now() - Math.floor(Math.random() * 60000)
});

const createMockHospital = (id) => ({
  id: `HOSP-${id}`,
  name: `City Hospital ${id}`,
  bedCount: Math.floor(Math.random() * 50) + 5,
  icuCount: Math.floor(Math.random() * 10),
  ambulanceCount: Math.floor(Math.random() * 5),
  saturation: Math.floor(Math.random() * 40) + 50,
  divert: Math.random() > 0.8
});

const createMockHospitalCase = (id) => ({
  id: `MED-${id}`,
  urgency: Math.random() > 0.7 ? 'critical' : 'high',
  facility: `City Hospital ${Math.floor(Math.random() * 5)}`,
  distance: (Math.random() * 15).toFixed(1),
  status: 'pending' // pending, confirmed, failed
});

const createMockEscalation = (id) => {
  const reasons = ['low_confidence', 'mixed_category', 'assignment_failed'];
  return {
    id: `ESC-${id}`,
    reason: reasons[Math.floor(Math.random() * reasons.length)],
    summary: 'System unable to confidently categorize incident report due to conflicting keywords.',
    promptVersion: 'v2.4.1',
    resolved: false
  };
};
