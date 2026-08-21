# Multi-Agent Disaster Coordination System

This is a multi-agent system designed for automated disaster coordination and emergency response.

## Architecture

This application simulates autonomous agents coordinating asynchronously via a Node/Express server with Socket.io and a React client frontend.

- **Complaint Agent**: Simulates the intake of cases, handles duplicate detection, and publishes events.
- **Admin Agent**: The central router. Uses rule-based keyword matching (or LLM) to auto-route cases or escalate ambiguous cases for human-in-the-loop review.
- **Hospital Agent**: Maintains medical resource availability and assigns incoming medical cases based on proximity and capacity.
- **NGO Agent**: Maintains food/shelter resource availability and assigns incoming cases based on proximity and capacity.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS (`client/`)
- **Backend**: Node.js + Express + Socket.io + MongoDB (`server/`)
- **State & Messaging**: In-Memory EventBus & WebSocket events

## How to Run

### 1. Server Setup
Navigate into the `server` directory, install dependencies, and start the server:
```bash
cd server
npm install
npm run dev
```

### 2. Client Setup
Navigate into the `client` directory, install dependencies, and start the Vite dev server:
```bash
cd client
npm install
npm run dev
```

### 3. Run the Simulation
Open the application in your browser (usually `http://localhost:5173`).
Use the dashboard to monitor real-time disaster coordination cases, escalations, and resource assignments.
