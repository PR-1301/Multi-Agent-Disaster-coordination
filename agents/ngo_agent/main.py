import threading
import math
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from shared.database import get_db, engine, Base
from shared.models import NGO
from shared.events import AssignmentConfirmedEvent, AssignmentFailedEvent, Location
from shared.redis_stream import EventBus

Base.metadata.create_all(bind=engine)

app = FastAPI(title="NGO Agent")
event_bus = EventBus(service_name="ngo-agent")

class AvailabilityUpdate(BaseModel):
    ngo_id: str
    food_units: int
    shelter_capacity: int
    supply_units: int

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
        if payload.get("target_agent") != "ngo":
            return
            
        case_id = payload.get("case_id")
        loc = payload.get("location", {})
        lat = loc.get("lat", 0.0)
        lng = loc.get("lng", 0.0)
        
        db = next(get_db())
        ngos = db.query(NGO).filter(NGO.shelter_capacity > 0).all() # Simple check on shelter
        
        if not ngos:
            # Publish failed
            event = AssignmentFailedEvent(
                **payload,
                event="assignment.failed",
                reason="No NGO shelter capacity available"
            )
            event_bus.publish("assignment.failed", event.model_dump())
            db.close()
            return
            
        # Find nearest
        nearest = min(ngos, key=lambda n: haversine(lat, lng, n.lat, n.lng))
        
        # Decrement capacity
        nearest.shelter_capacity -= 1
        db.commit()
        
        # Publish confirmed
        event = AssignmentConfirmedEvent(
            **payload,
            event="assignment.confirmed",
            assigned_facility_id=nearest.id,
            assigned_facility_name=nearest.name
        )
        event_bus.publish("assignment.confirmed", event.model_dump())
        print(f"[ngo-agent] Assigned case {case_id} to {nearest.name}")
        db.close()

    callbacks = {
        "case.routed": on_case_routed
    }
    
    event_bus.consume(group_name="ngo_group", consumer_name="ngo_worker_1", callback_map=callbacks)

@app.on_event("startup")
def startup_event():
    threading.Thread(target=start_consumer, daemon=True).start()

@app.post("/availability")
def update_availability(req: AvailabilityUpdate, db: Session = Depends(get_db)):
    n = db.query(NGO).filter(NGO.id == req.ngo_id).first()
    if n:
        n.food_units = req.food_units
        n.shelter_capacity = req.shelter_capacity
        n.supply_units = req.supply_units
        db.commit()
        return {"status": "updated"}
    return {"status": "not found"}

@app.get("/ngos")
def get_ngos(db: Session = Depends(get_db)):
    ngos = db.query(NGO).all()
    return {"ngos": ngos}
