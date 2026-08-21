import uuid
import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON
from .database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Case(Base):
    __tablename__ = "cases"
    id = Column(String, primary_key=True, default=generate_uuid)
    sector_id = Column(String, index=True)
    reported_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    category_hint = Column(String) # medical | shelter | rescue | unknown
    urgency = Column(String) # low | medium | high
    description = Column(String)
    location_lat = Column(Float)
    location_lng = Column(Float)
    source_command_center = Column(String)
    status = Column(String, default="open") # open | routed | resolved
    assigned_to = Column(String, nullable=True)

class Hospital(Base):
    __tablename__ = "hospitals"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    bed_count = Column(Integer, default=0)
    icu_count = Column(Integer, default=0)
    ambulance_count = Column(Integer, default=0)

class NGO(Base):
    __tablename__ = "ngos"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    food_units = Column(Integer, default=0)
    shelter_capacity = Column(Integer, default=0)
    supply_units = Column(Integer, default=0)

class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id"))
    caller_ref = Column(String)
    original_payload = Column(JSON)

class Escalation(Base):
    __tablename__ = "escalations"
    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id"))
    reason = Column(String)
    status = Column(String, default="pending") # pending | resolved

class EventLog(Base):
    __tablename__ = "event_log"
    id = Column(String, primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    service_name = Column(String)
    event_type = Column(String)
    payload = Column(JSON)
