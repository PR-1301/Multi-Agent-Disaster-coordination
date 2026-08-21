import os
import math
import logging
import asyncio
import httpx
from typing import List, Dict, Optional, Any
from fastapi import FastAPI, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.transaction import transactional

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Hospital Agent Service", version="1.0.1")

# Environment Variables
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS", "path/to/firebase-adminsdk.json")
ADMIN_AGENT_URL = os.getenv("ADMIN_AGENT_URL", "http://localhost:8000/status_update")

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}")

# --- Pydantic Models ---

class LocationCoordinates(BaseModel):
    lat: float
    lng: float

class MedicalRequest(BaseModel):
    incident_id: str
    location: LocationCoordinates
    emergency_beds_required: int = 0
    icu_beds_required: int = 0
    ambulances_required: int = 0
    medical_resources_required: int = 0

class AllocationResponse(BaseModel):
    status: str
    incident_id: str
    allocated_hospital_id: Optional[str] = None
    message: str

# --- Utility Functions ---

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in kilometers between two points."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers
    return c * r

def calculate_hospital_suitability_score(h_data: dict, req: MedicalRequest, distance: float) -> float:
    """
    Calculates a suitability score (lower is better).
    Starts with distance as the baseline penalty, then subtracts bonuses for having abundant resources.
    """
    score = distance
    
    # Calculate excess resources
    extra_emergency = max(0, h_data.get('emergency_beds', 0) - req.emergency_beds_required)
    extra_icu = max(0, h_data.get('icu_beds', 0) - req.icu_beds_required)
    extra_ambulances = max(0, h_data.get('ambulances', 0) - req.ambulances_required)
    extra_med = max(0, h_data.get('medical_resources', 0) - req.medical_resources_required)
    
    # Resource bonuses (e.g., 0.1km equivalent distance reduction per extra bed)
    # ICU and Ambulances are weighted heavier as they are critical scarce resources
    bonus = (extra_emergency * 0.1) + (extra_icu * 0.3) + (extra_ambulances * 0.5) + (extra_med * 0.05)
    
    return score - bonus

async def notify_admin_agent(incident_id: str, status_val: str, hospital_id: str = None):
    """Pushes a status update to the Admin Agent asynchronously."""
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "incident_id": incident_id,
                "service": "Medical",
                "status": status_val,
                "allocated_hospital_id": hospital_id
            }
            # Admin Agent would have an endpoint to receive sub-task updates
            await client.post(ADMIN_AGENT_URL, json=payload, timeout=5.0)
            logger.info(f"Successfully notified Admin Agent for incident {incident_id}: {status_val}")
    except Exception as e:
        logger.error(f"Failed to push update to Admin Agent for {incident_id}: {e}")

# --- Allocation Logic ---

@transactional
def allocate_resources_in_transaction(transaction, hospital_ref, req: MedicalRequest):
    """
    Transactional function to safely check and decrement hospital resources.
    Returns True if allocation was successful, False otherwise.
    """
    snapshot = hospital_ref.get(transaction=transaction)
    if not snapshot.exists:
        return False
    
    hospital_data = snapshot.to_dict()
    
    # Check if resources are currently available
    if not hospital_data.get('current_availability', False):
        return False

    # Check if resources are sufficient
    if (hospital_data.get('emergency_beds', 0) >= req.emergency_beds_required and
        hospital_data.get('icu_beds', 0) >= req.icu_beds_required and
        hospital_data.get('ambulances', 0) >= req.ambulances_required and
        hospital_data.get('medical_resources', 0) >= req.medical_resources_required):
        
        # Decrement resources safely
        new_emergency_beds = hospital_data['emergency_beds'] - req.emergency_beds_required
        new_icu_beds = hospital_data['icu_beds'] - req.icu_beds_required
        new_ambulances = hospital_data['ambulances'] - req.ambulances_required
        new_medical_resources = hospital_data['medical_resources'] - req.medical_resources_required
        
        # Update current availability flag
        is_available = (new_emergency_beds > 0) or (new_icu_beds > 0) or (new_medical_resources > 0)
        
        transaction.update(hospital_ref, {
            'emergency_beds': new_emergency_beds,
            'icu_beds': new_icu_beds,
            'ambulances': new_ambulances,
            'medical_resources': new_medical_resources,
            'current_availability': is_available
        })
        return True
    
    return False

# --- API Endpoints ---

@app.post("/allocate", response_model=AllocationResponse)
async def allocate_hospital(req: MedicalRequest, background_tasks: BackgroundTasks):
    """
    Receives a medical request, finds a suitable hospital based on distance and capacity,
    allocates resources safely, and notifies the Admin Agent.
    """
    try:
        hospitals_ref = db.collection('hospitals')
        hospitals = hospitals_ref.where('current_availability', '==', True).stream()
        
        eligible_hospitals = []
        
        for doc in hospitals:
            h_data = doc.to_dict()
            h_data['id'] = doc.id
            
            # 1. Check basic capacity
            if (h_data.get('emergency_beds', 0) >= req.emergency_beds_required and
                h_data.get('icu_beds', 0) >= req.icu_beds_required and
                h_data.get('ambulances', 0) >= req.ambulances_required and
                h_data.get('medical_resources', 0) >= req.medical_resources_required):
                
                # 2. Check Distance
                h_lat = h_data.get('location', {}).get('lat')
                h_lng = h_data.get('location', {}).get('lng')
                
                if h_lat is not None and h_lng is not None:
                    dist = haversine(req.location.lat, req.location.lng, h_lat, h_lng)
                    
                    # 3. Calculate Suitability Score
                    score = calculate_hospital_suitability_score(h_data, req, dist)
                    
                    h_data['distance'] = dist
                    h_data['suitability_score'] = score
                    eligible_hospitals.append(h_data)
        
        # If no eligible hospitals found, trigger escalation
        if not eligible_hospitals:
            logger.warning(f"Escalation triggered for incident {req.incident_id}: No hospitals with sufficient resources.")
            background_tasks.add_task(notify_admin_agent, req.incident_id, "ESCALATED")
            return AllocationResponse(
                status="ESCALATED",
                incident_id=req.incident_id,
                message="Insufficient resources across all nearby hospitals. Escalation triggered."
            )
        
        # Sort by best suitability score (lowest score is best)
        eligible_hospitals.sort(key=lambda x: x['suitability_score'])
        
        # Attempt transactional allocation starting from the best candidate
        transaction = db.transaction()
        allocated_hospital_id = None
        
        for hospital in eligible_hospitals:
            h_ref = hospitals_ref.document(hospital['id'])
            try:
                success = allocate_resources_in_transaction(transaction, h_ref, req)
                if success:
                    allocated_hospital_id = hospital['id']
                    break
            except Exception as e:
                logger.error(f"Transaction failed for hospital {hospital['id']}: {e}")
                continue # Try the next best hospital
                
        if allocated_hospital_id:
            logger.info(f"Successfully allocated resources at hospital {allocated_hospital_id} for incident {req.incident_id}")
            # 4. Continuously update the Admin Agent by pushing the status update
            background_tasks.add_task(notify_admin_agent, req.incident_id, "IN PROGRESS", allocated_hospital_id)
            
            return AllocationResponse(
                status="IN PROGRESS",
                incident_id=req.incident_id,
                allocated_hospital_id=allocated_hospital_id,
                message="Resources allocated successfully."
            )
        else:
            # Race condition occurred, all eligible hospitals lost resources before we could lock
            logger.warning(f"Escalation triggered for incident {req.incident_id}: Resources became unavailable during allocation.")
            background_tasks.add_task(notify_admin_agent, req.incident_id, "ESCALATED")
            return AllocationResponse(
                status="ESCALATED",
                incident_id=req.incident_id,
                message="Resources depleted during allocation attempt. Escalation triggered."
            )
            
    except Exception as e:
        logger.error(f"Error processing allocation request: {e}")
        background_tasks.add_task(notify_admin_agent, req.incident_id, "ESCALATED")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the allocation request."
        )

@app.get("/health")
async def health_check():
    return {"status": "ok"}
