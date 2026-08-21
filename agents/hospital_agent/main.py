import threading
import math
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from shared.database import get_db, engine, Base
from shared.models import Hospital
from shared.events import AssignmentConfirmedEvent, AssignmentFailedEvent, Location
from shared.redis_stream import EventBus

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Hospital Agent")
event_bus = EventBus(service_name="hospital-agent")

class AvailabilityUpdate(BaseModel):
    hospital_id: str
    bed_count: int
    icu_count: int
    ambulance_count: int

def haversine(lat1, lon1, lat2, lon2):
    R = 6371 # km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) * math.sin(dlon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def start_consumer():
    def on_case_routed(payload):
        if payload.get("target_agent") != "hospital":
            return
            
        case_id = payload.get("case_id")
        loc = payload.get("location", {})
        lat = loc.get("lat", 0.0)
        lng = loc.get("lng", 0.0)
        
        db = next(get_db())
        hospitals = db.query(Hospital).filter(Hospital.bed_count > 0).all()
        
        if not hospitals:
            # Publish failed
            event = AssignmentFailedEvent(
                **payload,
                event="assignment.failed",
                reason="No hospital beds available"
            )
            event_bus.publish("assignment.failed", event.model_dump())
            db.close()
            return
            
        # Find nearest
        nearest = min(hospitals, key=lambda h: haversine(lat, lng, h.lat, h.lng))
        
        # Decrement capacity
        nearest.bed_count -= 1
        db.commit()
        
        # Publish confirmed
        event = AssignmentConfirmedEvent(
            **payload,
            event="assignment.confirmed",
            assigned_facility_id=nearest.id,
            assigned_facility_name=nearest.name
        )
        event_bus.publish("assignment.confirmed", event.model_dump())
        print(f"[hospital-agent] Assigned case {case_id} to {nearest.name}")
        db.close()

    callbacks = {
        "case.routed": on_case_routed
    }
    
    event_bus.consume(group_name="hospital_group", consumer_name="hospital_worker_1", callback_map=callbacks)

@app.on_event("startup")
def startup_event():
    threading.Thread(target=start_consumer, daemon=True).start()

@app.post("/availability")
def update_availability(req: AvailabilityUpdate, db: Session = Depends(get_db)):
    h = db.query(Hospital).filter(Hospital.id == req.hospital_id).first()
    if h:
        h.bed_count = req.bed_count
        h.icu_count = req.icu_count
        h.ambulance_count = req.ambulance_count
        db.commit()
        return {"status": "updated"}
    return {"status": "not found"}

@app.get("/hospitals")
def get_hospitals(db: Session = Depends(get_db)):
    hospitals = db.query(Hospital).all()
    return {"hospitals": hospitals}
