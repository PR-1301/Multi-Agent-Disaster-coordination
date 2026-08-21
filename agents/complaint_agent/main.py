import os
import threading
import datetime
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from shared.database import get_db, engine, Base
from shared.models import Case, Complaint
from shared.events import Location, CaseCreatedEvent
from shared.redis_stream import EventBus

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Complaint Agent")
event_bus = EventBus(service_name="complaint-agent")

rescue_requests = []

class ComplaintRequest(BaseModel):
    sector_id: str
    caller_ref: str
    description: str
    urgency: str
    location: Location

def start_consumer():
    def on_case_resolved(payload):
        case_id = payload.get("case_id")
        db = next(get_db())
        case = db.query(Case).filter(Case.id == case_id).first()
        if case:
            case.status = "resolved"
            db.commit()
            print(f"[complaint-agent] Marked case {case_id} as resolved")
        db.close()
        
    def on_rescue_requested(payload):
        rescue_requests.append(payload)
        print(f"[complaint-agent] Logged rescue request for case {payload.get('case_id')}")

    callbacks = {
        "case.resolved": on_case_resolved,
        "rescue.requested": on_rescue_requested
    }
    
    event_bus.consume(group_name="complaint_group", consumer_name="complaint_worker_1", callback_map=callbacks)

@app.on_event("startup")
def startup_event():
    threading.Thread(target=start_consumer, daemon=True).start()

@app.post("/cases", status_code=201)
def create_case(req: ComplaintRequest, db: Session = Depends(get_db)):
    ten_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=10)
    
    recent_cases = db.query(Case).filter(
        Case.sector_id == req.sector_id,
        Case.reported_at >= ten_mins_ago,
        Case.status == "open"
    ).all()
    
    duplicate_case = None
    for c in recent_cases:
        if abs(c.location_lat - req.location.lat) < 0.005 and abs(c.location_lng - req.location.lng) < 0.005:
            duplicate_case = c
            break
            
    if duplicate_case:
        complaint = Complaint(case_id=duplicate_case.id, caller_ref=req.caller_ref, original_payload=req.model_dump())
        db.add(complaint)
        db.commit()
        return {"message": "Linked to existing case", "case_id": duplicate_case.id}

    new_case = Case(
        sector_id=req.sector_id,
        category_hint="unknown",
        urgency=req.urgency,
        description=req.description,
        location_lat=req.location.lat,
        location_lng=req.location.lng,
        source_command_center=req.caller_ref
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    
    complaint = Complaint(case_id=new_case.id, caller_ref=req.caller_ref, original_payload=req.model_dump())
    db.add(complaint)
    db.commit()
    
    event = CaseCreatedEvent(
        case_id=new_case.id,
        sector_id=new_case.sector_id,
        reported_at=new_case.reported_at.isoformat(),
        category_hint=new_case.category_hint,
        urgency=new_case.urgency,
        description=new_case.description,
        location=Location(lat=new_case.location_lat, lng=new_case.location_lng),
        source_command_center=new_case.source_command_center
    )
    
    event_bus.publish("case.created", event.model_dump())
    
    return {"message": "Case created", "case_id": new_case.id}

@app.get("/rescue-requests")
def get_rescue_requests():
    return {"rescue_requests": rescue_requests}
