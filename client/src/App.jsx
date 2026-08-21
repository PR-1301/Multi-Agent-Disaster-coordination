import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Activity, AlertTriangle, Building } from 'lucide-react';
import CaseBoard from './pages/CaseBoard';
import EscalationQueue from './pages/EscalationQueue';
import ResourceDashboard from './pages/ResourceDashboard';
import AlertBanner from './components/AlertBanner';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100 font-sans">
        <AlertBanner />
        <nav className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent tracking-tight">
              Disaster Coord
            </h1>
            <div className="flex gap-2">
              <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-all">
                <Activity size={18} /> Cases
              </Link>
              <Link to="/escalations" className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-all">
                <AlertTriangle size={18} /> Escalations
              </Link>
              <Link to="/resources" className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-all">
                <Building size={18} /> Resources
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1 max-w-7xl mx-auto w-full p-6 animate-in fade-in duration-500">
          <Routes>
            <Route path="/" element={<CaseBoard />} />
            <Route path="/escalations" element={<EscalationQueue />} />
            <Route path="/resources" element={<ResourceDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
