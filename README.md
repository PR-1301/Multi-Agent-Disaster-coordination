# Multi-Agent Disaster Coordination System

This is a browser-only, multi-agent system designed for automated disaster coordination and emergency response.

## Architecture

This application simulates autonomous agents entirely within the browser using React and TypeScript. An in-memory `EventBus` replaces the traditional backend message broker, allowing independent frontend "agents" to coordinate asynchronously.

- **Complaint Agent**: Simulates the intake of cases, handles duplicate detection, and publishes events.
- **Admin Agent**: The central router. Uses rule-based keyword matching to auto-route cases or escalate ambiguous cases for human-in-the-loop review.
- **Hospital Agent**: Maintains medical resource availability and assigns incoming medical cases based on proximity (Haversine distance) and capacity.
- **NGO Agent**: Maintains food/shelter resource availability and assigns incoming cases based on proximity and capacity.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **State Management**: Zustand
- **Messaging**: Custom In-Memory TypeScript EventBus (Pub/Sub)

## How to Run

1. **Install Dependencies**:
   Navigate into the `frontend` directory and install the Node packages.
   ```bash
   cd frontend
   npm install
   ```

2. **Start the Development Server**:
   ```bash
   npm run dev
   ```

3. **Run the Simulation**:
   Open the application in your browser (usually `http://localhost:5173`).
   Click the **"▶ Run Demo Simulation"** button in the top right corner. This will seed the initial hospitals and NGOs into the global state, and stream simulated complaints into the `ComplaintAgent`. You can watch the agents route and resolve cases in real-time.
