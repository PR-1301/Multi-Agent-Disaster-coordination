import { Location } from '../types';

export interface BaseEvent {
  event: string;
  case_id: string;
  sector_id: string;
  reported_at: string;
  category_hint: string; // medical | shelter | rescue | unknown
  urgency: string; // low | medium | high
  description: string;
  location: Location;
  source_command_center: string;
}

export interface CaseCreatedEvent extends BaseEvent {
  event: 'case.created';
}

export interface CaseRoutedEvent extends BaseEvent {
  event: 'case.routed';
  target_agent: string; // hospital | ngo | rescue
}

export interface AssignmentConfirmedEvent extends BaseEvent {
  event: 'assignment.confirmed';
  assigned_facility_id: string;
  assigned_facility_name: string;
}

export interface AssignmentFailedEvent extends BaseEvent {
  event: 'assignment.failed';
  reason: string;
}

export interface EscalationRaisedEvent extends BaseEvent {
  event: 'escalation.raised';
  reason: string;
}

export interface EscalationResolvedEvent extends BaseEvent {
  event: 'escalation.resolved';
  action: string; // assigned_hospital | assigned_ngo | rejected | split
}

export interface CaseResolvedEvent extends BaseEvent {
  event: 'case.resolved';
  resolution_notes: string;
}

export interface RescueRequestedEvent extends BaseEvent {
  event: 'rescue.requested';
  confidence_score: number;
}
