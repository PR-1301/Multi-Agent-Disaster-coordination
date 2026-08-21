import { v4 as uuidv4 } from 'uuid';
import { globalEventBus } from '../core/EventBus';
import { useDisasterStore } from '../store/DisasterStore';
import { CaseCreatedEvent, CaseResolvedEvent } from '../core/events';

export class ComplaintAgent {
  constructor() {
    globalEventBus.on('case.resolved', this.handleCaseResolved);
  }

  public receiveComplaint(payload: any) {
    const store = useDisasterStore.getState();
    const { cases } = store;
    
    const duplicate = cases.find(c => 
      c.sector_id === payload.sector_id &&
      c.status === 'open' &&
      Math.abs(c.location_lat - payload.location.lat) < 0.005 &&
      Math.abs(c.location_lng - payload.location.lng) < 0.005
    );

    if (duplicate) {
      console.log(`[ComplaintAgent] Duplicate detected. Linking to case ${duplicate.id}`);
      return;
    }

    const newCase = {
      id: uuidv4(),
      sector_id: payload.sector_id,
      reported_at: new Date().toISOString(),
      category_hint: 'unknown',
      urgency: payload.urgency,
      description: payload.description,
      location_lat: payload.location.lat,
      location_lng: payload.location.lng,
      source_command_center: payload.caller_ref,
      status: 'open'
    };

    store.addCase(newCase);

    const event: CaseCreatedEvent = {
      event: 'case.created',
      case_id: newCase.id,
      sector_id: newCase.sector_id,
      reported_at: newCase.reported_at,
      category_hint: newCase.category_hint,
      urgency: newCase.urgency,
      description: newCase.description,
      location: { lat: newCase.location_lat, lng: newCase.location_lng },
      source_command_center: newCase.source_command_center
    };

    globalEventBus.publish('case.created', event);
  }

  private handleCaseResolved = (payload: CaseResolvedEvent) => {
    const store = useDisasterStore.getState();
    store.updateCase(payload.case_id, { status: 'resolved' });
    console.log(`[ComplaintAgent] Case ${payload.case_id} marked as resolved.`);
  }
}

export const complaintAgent = new ComplaintAgent();
