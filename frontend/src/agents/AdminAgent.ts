import { v4 as uuidv4 } from 'uuid';
import { globalEventBus } from '../core/EventBus';
import { useDisasterStore } from '../store/DisasterStore';
import { CaseCreatedEvent, CaseRoutedEvent, EscalationRaisedEvent, AssignmentConfirmedEvent, AssignmentFailedEvent, CaseResolvedEvent } from '../core/events';

export class AdminAgent {
  constructor() {
    globalEventBus.on('case.created', this.handleCaseCreated);
    globalEventBus.on('assignment.confirmed', this.handleAssignmentConfirmed);
    globalEventBus.on('assignment.failed', this.handleAssignmentFailed);
  }

  private handleCaseCreated = (payload: CaseCreatedEvent) => {
    const desc = payload.description.toLowerCase();
    
    const medicalKw = ["injury", "blood", "medical", "heart", "pain", "doctor", "ambulance"];
    const ngoKw = ["food", "water", "shelter", "blanket", "hungry", "cold", "homeless"];
    const rescueKw = ["trapped", "collapse", "missing", "rubble", "drowning"];
    
    let medScore = medicalKw.filter(kw => desc.includes(kw)).length;
    let ngoScore = ngoKw.filter(kw => desc.includes(kw)).length;
    let rescueScore = rescueKw.filter(kw => desc.includes(kw)).length;
    
    let totalScore = medScore + ngoScore + rescueScore;
    
    let maxScore = Math.max(medScore, ngoScore, rescueScore);
    let maxTarget = "unknown";
    if (maxScore === medScore && medScore > 0) maxTarget = "hospital";
    else if (maxScore === ngoScore && ngoScore > 0) maxTarget = "ngo";
    else if (maxScore === rescueScore && rescueScore > 0) maxTarget = "rescue";

    let confidence = totalScore > 0 ? (maxScore / totalScore) : 0;
    
    const store = useDisasterStore.getState();

    if (confidence > 0.6 && totalScore > 0 && (medScore === 0 || ngoScore === 0)) {
      store.updateCase(payload.case_id, { category_hint: maxTarget, status: 'routed' });
      
      if (maxTarget === 'rescue') {
        globalEventBus.publish('rescue.requested', { ...payload, event: 'rescue.requested', confidence_score: confidence });
      } else {
        const event: CaseRoutedEvent = { ...payload, event: 'case.routed', target_agent: maxTarget };
        globalEventBus.publish('case.routed', event);
      }
    } else {
      store.updateCase(payload.case_id, { status: 'open' });
      const reason = totalScore === 0 ? "Ambiguous case, needs human review" : "Low confidence or mixed needs";
      
      const newEscalation = {
        id: uuidv4(),
        case_id: payload.case_id,
        reason: reason,
        status: 'pending',
        case: store.cases.find(c => c.id === payload.case_id)!
      };
      
      store.addEscalation(newEscalation);
      globalEventBus.publish('escalation.raised', { ...payload, event: 'escalation.raised', reason });
    }
  }

  private handleAssignmentConfirmed = (payload: AssignmentConfirmedEvent) => {
    const store = useDisasterStore.getState();
    store.updateCase(payload.case_id, { status: 'resolved', assigned_to: payload.assigned_facility_id });
    
    const event: CaseResolvedEvent = { ...payload, event: 'case.resolved', resolution_notes: `Assigned to ${payload.assigned_facility_name}` };
    globalEventBus.publish('case.resolved', event);
  }

  private handleAssignmentFailed = (payload: AssignmentFailedEvent) => {
    const store = useDisasterStore.getState();
    const reason = `Assignment failed: ${payload.reason}`;
    
    const newEscalation = {
        id: uuidv4(),
        case_id: payload.case_id,
        reason: reason,
        status: 'pending',
        case: store.cases.find(c => c.id === payload.case_id)!
    };
      
    store.addEscalation(newEscalation);
    globalEventBus.publish('escalation.raised', { ...payload, event: 'escalation.raised', reason });
  }

  public resolveEscalation(escalationId: string, action: string) {
    const store = useDisasterStore.getState();
    const esc = store.escalations.find(e => e.id === escalationId);
    if (!esc) return;

    store.updateEscalation(escalationId, { status: 'resolved' });
    const c = store.cases.find(x => x.id === esc.case_id);
    if (!c) return;

    const basePayload = {
      case_id: c.id,
      sector_id: c.sector_id,
      reported_at: c.reported_at,
      category_hint: c.category_hint,
      urgency: c.urgency,
      description: c.description,
      location: { lat: c.location_lat, lng: c.location_lng },
      source_command_center: c.source_command_center
    };

    if (action === 'assigned_hospital') {
      store.updateCase(c.id, { category_hint: 'hospital', status: 'routed' });
      globalEventBus.publish('case.routed', { ...basePayload, event: 'case.routed', target_agent: 'hospital' } as CaseRoutedEvent);
    } else if (action === 'assigned_ngo') {
      store.updateCase(c.id, { category_hint: 'ngo', status: 'routed' });
      globalEventBus.publish('case.routed', { ...basePayload, event: 'case.routed', target_agent: 'ngo' } as CaseRoutedEvent);
    } else {
      store.updateCase(c.id, { status: 'resolved' });
      globalEventBus.publish('case.resolved', { ...basePayload, event: 'case.resolved', resolution_notes: `Manually resolved: ${action}` } as CaseResolvedEvent);
    }
  }
}

export const adminAgent = new AdminAgent();
