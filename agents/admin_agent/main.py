import threading
import json
import asyncio
from typing import AsyncGenerator
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from shared.database import get_db, engine, Base
from shared.models import Case, Escalation, EventLog
from shared.events import CaseRoutedEvent, EscalationRaisedEvent, CaseResolvedEvent
from shared.redis_stream import EventBus

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Admin Agent")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

event_bus = EventBus(service_name="admin-agent")

# Global queue for SSE events
sse_queues = []

def broadcast_sse(event_data: dict):
    for q in sse_queues:
        try:
            q.put_nowait(event_data)
        except asyncio.QueueFull:
            pass

class ResolveRequest(BaseModel):
    action: str # assigned_hospital | assigned_ngo | split | rejected

def start_consumer(loop):
    def on_case_created(payload):
        desc = payload.get("description", "").lower()
        case_id = payload.get("case_id")
        
        # Keyword matching
        medical_kw = ["injury", "blood", "medical", "heart", "pain", "doctor", "ambulance"]
        ngo_kw = ["food", "water", "shelter", "blanket", "hungry", "cold", "homeless"]
        rescue_kw = ["trapped", "collapse", "missing", "rubble", "drowning"]
        
        med_score = sum(1 for kw in medical_kw if kw in desc)
        ngo_score = sum(1 for kw in ngo_kw if kw in desc)
        rescue_score = sum(1 for kw in rescue_kw if kw in desc)
        
        scores = {"hospital": med_score, "ngo": ngo_score, "rescue": rescue_score}
        max_target = max(scores, key=scores.get)
        max_score = scores[max_target]
        total_score = med_score + ngo_score + rescue_score
        
        confidence = (max_score / total_score) if total_score > 0 else 0.0
        
        db = next(get_db())
        case = db.query(Case).filter(Case.id == case_id).first()
        
        if confidence > 0.6 and total_score > 0 and (med_score == 0 or ngo_score == 0):
            # Auto-route
            if case:
                case.category_hint = max_target
                case.status = "routed"
                db.commit()
                
            if max_target == "rescue":
                event_bus.publish("rescue.requested", {**payload, "event": "rescue.requested", "confidence_score": confidence})
            else:
                event = CaseRoutedEvent(**payload, event="case.routed", target_agent=max_target)
                event_bus.publish("case.routed", event.model_dump())
        else:
            # Escalate
            if case:
                case.status = "open" # needs manual review
                db.commit()
            
            reason = "Ambiguous case, needs human review" if total_score == 0 else "Low confidence or mixed needs"
            
            esc = Escalation(case_id=case_id, reason=reason)
            db.add(esc)
            db.commit()
            
            event = EscalationRaisedEvent(**payload, event="escalation.raised", reason=reason)
            event_bus.publish("escalation.raised", event.model_dump())
            
        db.close()
        # Broadcast to SSE
        loop.call_soon_threadsafe(broadcast_sse, payload)

    def on_assignment_confirmed(payload):
        case_id = payload.get("case_id")
        facility_id = payload.get("assigned_facility_id")
        
        db = next(get_db())
        case = db.query(Case).filter(Case.id == case_id).first()
        if case:
            case.status = "resolved"
            case.assigned_to = facility_id
            db.commit()
        db.close()
        
        event = CaseResolvedEvent(**payload, event="case.resolved", resolution_notes=f"Assigned to {payload.get('assigned_facility_name')}")
        event_bus.publish("case.resolved", event.model_dump())
        
        loop.call_soon_threadsafe(broadcast_sse, payload)
        
    def on_assignment_failed(payload):
        case_id = payload.get("case_id")
        reason = payload.get("reason")
        
        db = next(get_db())
        esc = Escalation(case_id=case_id, reason=f"Assignment failed: {reason}")
        db.add(esc)
        db.commit()
        db.close()
        
        event = EscalationRaisedEvent(**payload, event="escalation.raised", reason=reason)
        event_bus.publish("escalation.raised", event.model_dump())
        
        loop.call_soon_threadsafe(broadcast_sse, payload)
        
    def generic_broadcast(payload):
        loop.call_soon_threadsafe(broadcast_sse, payload)

    callbacks = {
        "case.created": on_case_created,
        "assignment.confirmed": on_assignment_confirmed,
        "assignment.failed": on_assignment_failed,
        "case.resolved": generic_broadcast,
        "escalation.raised": generic_broadcast,
        "case.routed": generic_broadcast
    }
    
    event_bus.consume(group_name="admin_group", consumer_name="admin_worker_1", callback_map=callbacks)

@app.on_event("startup")
def startup_event():
    loop = asyncio.get_running_loop()
    threading.Thread(target=start_consumer, args=(loop,), daemon=True).start()

@app.get("/cases")
def get_cases(db: Session = Depends(get_db)):
    return {"cases": db.query(Case).order_by(Case.reported_at.desc()).all()}

@app.get("/cases/{id}")
def get_case(id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == id).first()
    logs = db.query(EventLog).filter(EventLog.payload['case_id'].astext == id).order_by(EventLog.timestamp.asc()).all()
    return {"case": case, "history": logs}

@app.get("/escalations")
def get_escalations(db: Session = Depends(get_db)):
    escs = db.query(Escalation).filter(Escalation.status == "pending").all()
    # attach case details
    results = []
    for e in escs:
        c = db.query(Case).filter(Case.id == e.case_id).first()
        results.append({
            "id": e.id,
            "case_id": e.case_id,
            "reason": e.reason,
            "case": c
        })
    return {"escalations": results}

@app.post("/escalations/{id}/resolve")
def resolve_escalation(id: str, req: ResolveRequest, db: Session = Depends(get_db)):
    esc = db.query(Escalation).filter(Escalation.id == id).first()
    if not esc:
        return {"error": "not found"}
        
    esc.status = "resolved"
    case = db.query(Case).filter(Case.id == esc.case_id).first()
    
    # Simple original payload recreation
    payload = {
        "case_id": case.id,
        "sector_id": case.sector_id,
        "reported_at": case.reported_at.isoformat(),
        "category_hint": case.category_hint,
        "urgency": case.urgency,
        "description": case.description,
        "location": {"lat": case.location_lat, "lng": case.location_lng},
        "source_command_center": case.source_command_center
    }
    
    if req.action == "assigned_hospital":
        case.category_hint = "hospital"
        case.status = "routed"
        event = CaseRoutedEvent(**payload, event="case.routed", target_agent="hospital")
        event_bus.publish("case.routed", event.model_dump())
    elif req.action == "assigned_ngo":
        case.category_hint = "ngo"
        case.status = "routed"
        event = CaseRoutedEvent(**payload, event="case.routed", target_agent="ngo")
        event_bus.publish("case.routed", event.model_dump())
    else:
        case.status = "resolved"
        event = CaseResolvedEvent(**payload, event="case.resolved", resolution_notes=f"Manually resolved: {req.action}")
        event_bus.publish("case.resolved", event.model_dump())

    db.commit()
    return {"status": "resolved"}

@app.get("/stream")
async def sse_stream(request: Request):
    async def event_generator() -> AsyncGenerator[dict, None]:
        q = asyncio.Queue()
        sse_queues.append(q)
        try:
            while True:
                if await request.is_disconnected():
                    break
                event_data = await q.get()
                yield {
                    "event": "message",
                    "data": json.dumps(event_data)
                }
        except asyncio.CancelledError:
            pass
        finally:
            sse_queues.remove(q)
            
    return EventSourceResponse(event_generator())
