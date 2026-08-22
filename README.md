# Multi-Agent Disaster Coordination System

A comprehensive disaster management and coordination platform that leverages AI (Large Language Models) to facilitate communication, resource allocation, and incident response between multiple agents including NGOs, Hospitals, and Administration.

## Key Features

- **Multi-Agent AI Coordination**: Utilizes specialized LLMs (OpenAI) to autonomously process complaints, triage incidents, and coordinate responses between different entities (NGOs, Admins).
- **Real-Time Communication**: Integrates Socket.io for live updates on incidents, complaints, and escalations across all connected dashboards.
- **Resource & Geographical Mapping**: Features 3D visualizations and geographical tracking using React Three Fiber and Three.js to map incidents and available resources (hospitals, NGOs).
- **Automated Workflows & Escalation**: Intelligent agent bus system that routes critical cases and automatically escalates severe incidents to appropriate administrative or medical bodies.
- **Comprehensive Dashboards**: Interactive UI for different roles built with React, Recharts, and Framer Motion.

## Tech Stack

### Frontend (Client)
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS 4, Framer Motion
- **3D Visualization**: Three.js, React Three Fiber (@react-three/fiber, @react-three/drei)
- **Data & State**: React Router DOM, React Query, Recharts
- **Real-Time**: Socket.io Client

### Backend (Server)
- **Runtime & Framework**: Node.js, Express
- **Database**: MongoDB (Mongoose)
- **AI / LLM**: OpenAI API integration
- **Real-Time**: Socket.io
- **Architecture**: Specialized routing (Incidents, Complaints, Hospitals, NGOs, Escalations) and Agent services (gentBus.js, llmClient.js).

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MongoDB instance (local or Atlas)
- OpenAI API Key

### Installation

1. **Clone the repository:**
   \\\ash
   git clone <repository-url>
   cd Multi-Agent-Disaster-coordination
   \\\

2. **Setup the Backend (Server):**
   \\\ash
   cd server
   npm install
   \\\
   - Create a \.env\ file in the \server\ directory and add your environment variables:
     \\\env
     PORT=5000
     MONGODB_URI=your_mongodb_uri
     OPENAI_API_KEY=your_openai_api_key
     \\\
   - Start the server:
     \\\ash
     npm run dev
     \\\

3. **Setup the Frontend (Client):**
   \\\ash
   cd ../client
   npm install
   \\\
   - Start the frontend development server:
     \\\ash
     npm run dev
     \\\

## Architecture Overview

- \server/services/\: Contains the core logic for the AI agents, including \gentBus.js\ for inter-agent communication, and \llmClient.js\ / \
goLLMClient.js\ for handling AI logic.
- \server/routes/\: REST API endpoints managing the various entities (cases, complaints, escalations).
- \client/src/pages/\: Contains the dashboard views for different agent roles (e.g., AdminAgent, NGO dashboard).

## License
ISC
