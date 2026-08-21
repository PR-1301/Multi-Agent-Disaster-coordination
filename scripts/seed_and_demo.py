import os
import sys
import time
import random
import requests
from sqlalchemy.orm import Session

# Add project root to path so we can import shared
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from shared.database import SessionLocal, engine, Base
from shared.models import Hospital, NGO, Case, Complaint, Escalation, EventLog

# Configuration
COMPLAINT_API = "http://localhost:8001/cases"

# Seed Data
hospitals_data = [
    {"name": "Central General", "lat": 40.7128, "lng": -74.0060, "bed_count": 50, "icu_count": 10, "ambulance_count": 5},
    {"name": "Mercy Care", "lat": 40.7300, "lng": -73.9900, "bed_count": 20, "icu_count": 2, "ambulance_count": 2},
    {"name": "Northside Med", "lat": 40.7500, "lng": -73.9800, "bed_count": 100, "icu_count": 20, "ambulance_count": 10},
    {"name": "East River Clinic", "lat": 40.7200, "lng": -73.9700, "bed_count": 5, "icu_count": 0, "ambulance_count": 1},
]

ngos_data = [
    {"name": "Red Cross NY", "lat": 40.7150, "lng": -74.0100, "food_units": 1000, "shelter_capacity": 500, "supply_units": 200},
    {"name": "Food Bank Central", "lat": 40.7400, "lng": -73.9950, "food_units": 5000, "shelter_capacity": 0, "supply_units": 100},
    {"name": "City Rescue Mission", "lat": 40.7350, "lng": -73.9850, "food_units": 500, "shelter_capacity": 100, "supply_units": 50},
    {"name": "Global Relief Partners", "lat": 40.7600, "lng": -73.9700, "food_units": 2000, "shelter_capacity": 200, "supply_units": 500},
]

complaints = [
    # Medical (Clear route to hospital)
    {"sector_id": "SEC-1", "caller_ref": "CMD-001", "description": "Multiple injuries from building collapse, need ambulance and doctor urgently.", "urgency": "high", "location": {"lat": 40.7130, "lng": -74.0050}},
    {"sector_id": "SEC-2", "caller_ref": "CMD-002", "description": "Severe chest pain, suspected heart attack.", "urgency": "high", "location": {"lat": 40.7310, "lng": -73.9910}},
    # NGO (Clear route to ngo)
    {"sector_id": "SEC-3", "caller_ref": "CMD-003", "description": "People are homeless and cold, need shelter and blankets.", "urgency": "medium", "location": {"lat": 40.7410, "lng": -73.9960}},
    {"sector_id": "SEC-4", "caller_ref": "CMD-004", "description": "Running out of food and water for 50 people.", "urgency": "medium", "location": {"lat": 40.7160, "lng": -74.0120}},
    # Ambiguous/Escalation (Mixed keywords)
    {"sector_id": "SEC-5", "caller_ref": "CMD-005", "description": "People are trapped, we need food and a doctor immediately!", "urgency": "high", "location": {"lat": 40.7510, "lng": -73.9810}},
    # Vague (Escalation)
    {"sector_id": "SEC-6", "caller_ref": "CMD-006", "description": "Please send help to main street, it's a disaster.", "urgency": "low", "location": {"lat": 40.7200, "lng": -73.9800}},
    # Duplicate (Should be linked to SEC-1)
    {"sector_id": "SEC-1", "caller_ref": "CMD-007", "description": "More people found with injuries at the building collapse site.", "urgency": "high", "location": {"lat": 40.7131, "lng": -74.0049}},
    # Rescue (Rescue requested)
    {"sector_id": "SEC-7", "caller_ref": "CMD-008", "description": "Building collapsed, 3 people missing in the rubble.", "urgency": "high", "location": {"lat": 40.7300, "lng": -74.0000}},
]

def seed_database():
    print("Seeding database...")
    db = SessionLocal()
    
    # Optional: Clear old data for clean demo run
    db.query(EventLog).delete()
    db.query(Escalation).delete()
    db.query(Complaint).delete()
    db.query(Case).delete()
    db.query(Hospital).delete()
    db.query(NGO).delete()
    db.commit()

    for h in hospitals_data:
        hospital = Hospital(**h)
        db.add(hospital)
        
    for n in ngos_data:
        ngo = NGO(**n)
        db.add(ngo)
        
    db.commit()
    db.close()
    print("Database seeded with Hospitals and NGOs.")

def run_simulation():
    print("\nStarting simulation... sending complaints to Complaint Agent.")
    for comp in complaints:
        try:
            res = requests.post(COMPLAINT_API, json=comp)
            if res.status_code == 201:
                print(f"✅ Sent complaint: {comp['description'][:50]}... -> {res.json()}")
            else:
                print(f"❌ Failed to send complaint: {res.text}")
        except Exception as e:
            print(f"❌ Error sending complaint: {e}")
            
        time.sleep(random.uniform(2.0, 4.0)) # Delay between complaints for real-time effect
        
    print("\nSimulation complete. Check the operator console!")

if __name__ == "__main__":
    seed_database()
    run_simulation()
