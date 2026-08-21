import { globalEventBus } from '../core/EventBus';
import { useDisasterStore } from '../store/DisasterStore';
import { CaseRoutedEvent, AssignmentConfirmedEvent, AssignmentFailedEvent } from '../core/events';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dlat = (lat2 - lat1) * Math.PI / 180;
  const dlon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dlon / 2) * Math.sin(dlon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class NGOAgent {
  constructor() {
    globalEventBus.on('case.routed', this.handleCaseRouted);
  }

  private handleCaseRouted = (payload: CaseRoutedEvent) => {
    if (payload.target_agent !== 'ngo') return;

    const store = useDisasterStore.getState();
    const availableNgos = store.ngos.filter(n => n.shelter_capacity > 0);

    if (availableNgos.length === 0) {
      const failedEvent: AssignmentFailedEvent = {
        ...payload,
        event: 'assignment.failed',
        reason: 'No NGO shelter capacity available'
      };
      globalEventBus.publish('assignment.failed', failedEvent);
      return;
    }

    const { lat, lng } = payload.location;
    let nearest = availableNgos[0];
    let minDistance = haversine(lat, lng, nearest.lat, nearest.lng);

    for (let i = 1; i < availableNgos.length; i++) {
      const n = availableNgos[i];
      const dist = haversine(lat, lng, n.lat, n.lng);
      if (dist < minDistance) {
        nearest = n;
        minDistance = dist;
      }
    }

    store.updateNGOCapacity(nearest.id, nearest.shelter_capacity - 1);

    const confirmedEvent: AssignmentConfirmedEvent = {
      ...payload,
      event: 'assignment.confirmed',
      assigned_facility_id: nearest.id,
      assigned_facility_name: nearest.name
    };

    globalEventBus.publish('assignment.confirmed', confirmedEvent);
  }
}

export const ngoAgent = new NGOAgent();
