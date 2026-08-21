from pydantic import BaseModel
from typing import Literal, Optional

class Location(BaseModel):
    lat: float
    lng: float

class BaseEvent(BaseModel):
    event: str
    case_id: str
    sector_id: str
    reported_at: str
    category_hint: str # medical | shelter | rescue | unknown
    urgency: str # low | medium | high
    description: str
    location: Location
    source_command_center: str

class CaseCreatedEvent(BaseEvent):
    event: Literal["case.created"] = "case.created"

class CaseRoutedEvent(BaseEvent):
    event: Literal["case.routed"] = "case.routed"
    target_agent: str # hospital | ngo | rescue

class AssignmentConfirmedEvent(BaseEvent):
    event: Literal["assignment.confirmed"] = "assignment.confirmed"
    assigned_facility_id: str
    assigned_facility_name: str

class AssignmentFailedEvent(BaseEvent):
    event: Literal["assignment.failed"] = "assignment.failed"
    reason: str

class EscalationRaisedEvent(BaseEvent):
    event: Literal["escalation.raised"] = "escalation.raised"
    reason: str

class EscalationResolvedEvent(BaseEvent):
    event: Literal["escalation.resolved"] = "escalation.resolved"
    action: str # assigned_hospital | assigned_ngo | rejected | split

class CaseResolvedEvent(BaseEvent):
    event: Literal["case.resolved"] = "case.resolved"
    resolution_notes: str

class RescueRequestedEvent(BaseEvent):
    event: Literal["rescue.requested"] = "rescue.requested"
    confidence_score: float
