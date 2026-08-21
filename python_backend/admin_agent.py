import asyncio
import logging
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
import httpx

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Admin Agent Orchestrator", version="1.0.0")

# --- Configuration & Mocks ---
# In a real system, these would be environment variables pointing to actual services
HOSPITAL_AGENT_URL = "http://localhost:8001/allocate"
NGO_AGENT_URL = "http://localhost:8002/allocate"
RESCUE_AGENT_URL = "http://localhost:8003/dispatch"
WEBHOOK_URL_HITL = "http://localhost:8080/hitl_webhook"  # External endpoint for human review

# --- State Management (In-Memory for demonstration) ---
# In production, use Redis or a Database to store state persistently for resumability.
# Structure: { incident_id: { "status": str, "sub_tasks": dict, "payload": dict, "hitl_reason": str } }
INCIDENT_STATES: Dict[str, Dict[str, Any]] = {}

# --- Pydantic Models ---

class LocationCoordinates(BaseModel):
    lat: float
    lng: float

class IncidentPayload(BaseModel):
    incident_id: str
    location: LocationCoordinates
    description: str
    requires_medical: bool = False
    requires_shelter: bool = False
    requires_rescue: bool = False
    # Specific requirements
    emergency_beds_required: int = 0
    icu_beds_required: int = 0
    ambulances_required: int = 0
    food_units_required: int = 0
    shelter_capacity_required: int = 0

class HITLResolution(BaseModel):
    incident_id: str
    action: str  # e.g., "approve", "override", "abort"
    override_data: Optional[Dict[str, Any]] = None

# --- Helper Functions ---

async def call_worker_agent(client: httpx.AsyncClient, url: str, payload: dict, service_name: str) -> dict:
    """Helper to call a worker agent asynchronously."""
    try:
        response = await client.post(url, json=payload, timeout=10.0)
        response.raise_for_status()
        return {"service": service_name, "success": True, "data": response.json()}
    except Exception as e:
        logger.error(f"Error calling {service_name} at {url}: {e}")
        return {"service": service_name, "success": False, "error": str(e)}

async def trigger_hitl_webhook(incident_id: str, reason: str, state_data: dict):
    """Triggers an external webhook to notify human operators."""
    payload = {
        "incident_id": incident_id,
        "reason": reason,
        "current_state": state_data
    }
    logger.warning(f"[HITL TRIGGERED] Incident: {incident_id} | Reason: {reason}")
    try:
        async with httpx.AsyncClient() as client:
            await client.post(WEBHOOK_URL_HITL, json=payload, timeout=5.0)
    except Exception as e:
        logger.error(f"Failed to trigger HITL webhook for {incident_id}: {e}")

def update_incident_state(incident_id: str, updates: dict):
    """Aggregates state updates into the central tracker."""
    if incident_id not in INCIDENT_STATES:
        return
    
    state = INCIDENT_STATES[incident_id]
    
    # Update sub-tasks
    if "sub_tasks" in updates:
        state["sub_tasks"].update(updates["sub_tasks"])
        
    # Determine overall status dynamically
    all_success = True
    any_escalated = False
    
    for task_name, task_result in state["sub_tasks"].items():
        if task_result.get("status") == "ESCALATED" or not task_result.get("success", True):
            any_escalated = True
        elif task_result.get("status") != "IN PROGRESS" and task_result.get("status") != "COMPLETED":
            all_success = False

    if any_escalated:
        state["status"] = "PAUSED_FOR_HITL"
    elif all_success and len(state["sub_tasks"]) > 0:
        state["status"] = "IN PROGRESS"
        
    INCIDENT_STATES[incident_id] = state

# --- Orchestration Workflow ---

async def orchestrate_incident(payload: IncidentPayload):
    """
    Main orchestration logic. Dispatches tasks concurrently to specialized worker agents.
    """
    incident_id = payload.incident_id
    
    # Initialize state
    if incident_id not in INCIDENT_STATES:
        INCIDENT_STATES[incident_id] = {
            "status": "PROCESSING",
            "payload": payload.model_dump(),
            "sub_tasks": {}
        }
        
    state = INCIDENT_STATES[incident_id]
    
    if state["status"] == "PAUSED_FOR_HITL":
        logger.info(f"Incident {incident_id} is paused awaiting human review.")
        return

    logger.info(f"Starting orchestration for incident {incident_id}")
    
    tasks = []
    async with httpx.AsyncClient() as client:
        # Dispatch Medical Task
        if payload.requires_medical:
            medical_payload = {
                "incident_id": incident_id,
                "location": payload.location.model_dump(),
                "emergency_beds_required": payload.emergency_beds_required,
                "icu_beds_required": payload.icu_beds_required,
                "ambulances_required": payload.ambulances_required
            }
            tasks.append(call_worker_agent(client, HOSPITAL_AGENT_URL, medical_payload, "Medical"))
            
        # Dispatch NGO/Shelter Task
        if payload.requires_shelter:
            ngo_payload = {
                "incident_id": incident_id,
                "location": payload.location.model_dump(),
                "food_units_required": payload.food_units_required,
                "shelter_capacity_required": payload.shelter_capacity_required
            }
            tasks.append(call_worker_agent(client, NGO_AGENT_URL, ngo_payload, "Shelter"))
            
        # Dispatch Rescue Task
        if payload.requires_rescue:
            rescue_payload = {
                "incident_id": incident_id,
                "location": payload.location.model_dump(),
                "description": payload.description
            }
            tasks.append(call_worker_agent(client, RESCUE_AGENT_URL, rescue_payload, "Rescue"))

        # Wait for all tasks to complete concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

    # Process results and aggregate state
    sub_task_updates = {}
    hitl_reason = None
    
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Unexpected exception during orchestration: {result}")
            continue
            
        service = result["service"]
        
        if result["success"]:
            data = result["data"]
            sub_task_updates[service] = data
            
            # Check for worker agent escalations or conflicts
            if data.get("status") == "ESCALATED":
                hitl_reason = f"{service} agent escalated: {data.get('message')}"
        else:
            sub_task_updates[service] = {"success": False, "error": result["error"]}
            hitl_reason = f"{service} agent failed to respond: {result['error']}"

    # Update global state
    update_incident_state(incident_id, {"sub_tasks": sub_task_updates})
    
    # Handle HITL Trigger
    if hitl_reason:
        INCIDENT_STATES[incident_id]["status"] = "PAUSED_FOR_HITL"
        INCIDENT_STATES[incident_id]["hitl_reason"] = hitl_reason
        await trigger_hitl_webhook(incident_id, hitl_reason, INCIDENT_STATES[incident_id])
    else:
        logger.info(f"Orchestration complete for {incident_id}. State: {INCIDENT_STATES[incident_id]['status']}")

# --- API Endpoints ---

@app.post("/dispatch")
async def dispatch_incident(payload: IncidentPayload):
    """
    Endpoint to receive a new disaster incident and start orchestration.
    Uses asyncio.create_task to run orchestration in the background.
    """
    if payload.incident_id in INCIDENT_STATES:
        raise HTTPException(status_code=400, detail="Incident ID already exists.")
        
    # Start background task to allow immediate return to caller
    asyncio.create_task(orchestrate_incident(payload))
    
    return {"status": "ACCEPTED", "message": f"Incident {payload.incident_id} dispatch initiated."}

@app.get("/status/{incident_id}")
async def get_incident_status(incident_id: str):
    """Endpoint to check the aggregated status of an incident."""
    if incident_id not in INCIDENT_STATES:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return INCIDENT_STATES[incident_id]

@app.post("/resolve_hitl")
async def resolve_hitl(resolution: HITLResolution):
    """
    Endpoint for human operators to resolve a paused incident.
    """
    incident_id = resolution.incident_id
    if incident_id not in INCIDENT_STATES:
        raise HTTPException(status_code=404, detail="Incident not found.")
        
    state = INCIDENT_STATES[incident_id]
    if state["status"] != "PAUSED_FOR_HITL":
        raise HTTPException(status_code=400, detail="Incident is not paused for HITL.")
        
    logger.info(f"Received HITL resolution for {incident_id}: Action '{resolution.action}'")
    
    if resolution.action == "approve":
        # E.g., Human says it's fine, mark escalated tasks as resolved manually
        state["status"] = "IN PROGRESS"
        state["hitl_reason"] = None
        # In a real scenario, you might update specific sub-tasks based on override_data
        
    elif resolution.action == "override":
        # Apply manual overrides to payload or state, then resume
        state["status"] = "PROCESSING"
        state["hitl_reason"] = None
        if resolution.override_data:
             # Merge override data into original payload for re-processing
             state["payload"].update(resolution.override_data)
             
        # Resume orchestration with potentially new data
        payload = IncidentPayload(**state["payload"])
        asyncio.create_task(orchestrate_incident(payload))
        return {"status": "RESUMED", "message": f"Incident {incident_id} orchestration resumed with overrides."}
        
    elif resolution.action == "abort":
        state["status"] = "ABORTED"
        state["hitl_reason"] = "Aborted by human operator."
        
    else:
        raise HTTPException(status_code=400, detail="Unknown resolution action.")
        
    return {"status": "UPDATED", "current_state": state}
