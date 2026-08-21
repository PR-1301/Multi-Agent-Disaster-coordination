# Multi-Agent Disaster Coordination System

This is a prototype multi-agent system designed for automated disaster coordination and emergency response.

## Architecture

Four autonomous backend agents communicate via event-driven messaging (Redis Streams) to coordinate emergency response.
- **Complaint Agent**: Intake of cases, duplicate detection, and initial logging.
- **Admin Agent**: Central router. Uses rule-based keyword matching to auto-route cases or escalate ambiguous cases for human-in-the-loop review.
- **Hospital Agent**: Maintains medical resource availability and assigns incoming medical cases based on proximity and capacity.
- **NGO Agent**: Maintains food/shelter resource availability and assigns incoming cases based on proximity and capacity.

## Tech Stack
- **Backend**: Python (FastAPI), SQLAlchemy
- **Database**: PostgreSQL (Shared for demo simplicity)
- **Message Bus**: Redis Streams
- **Frontend**: React + Vite + Tailwind CSS
- **Infrastructure**: Docker Compose

## How to Run

1. **Start all services**:
   Run the following command from the project root:
   ```bash
   docker compose up --build
   ```
   This will spin up Postgres, Redis, the 4 Python agents, and the Vite React frontend.

2. **Run the Simulation Script**:
   In a separate terminal, run the demo script to populate the database and stream simulated complaints.
   Ensure you have installed the root requirements first (`pip install -r requirements.txt`).
   ```bash
   python scripts/seed_and_demo.py
   ```

3. **View the Operator Console**:
   Open your browser and navigate to:
   [http://localhost:3000](http://localhost:3000)

   Here you can watch cases arrive in real-time, see resources being allocated, and manually resolve escalated ambiguous cases.
