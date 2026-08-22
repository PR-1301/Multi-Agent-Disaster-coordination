import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HudLayout from './components/hud/HudLayout';
import ComplaintAgent from './pages/ComplaintAgent';
import NgoAgent from './pages/NgoAgent';
import HospitalAgent from './pages/HospitalAgent';
import AdminAgent from './pages/AdminAgent';
import PublicIntake from './pages/PublicIntake';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/public-intake" element={<PublicIntake />} />
        
        {/* Wrap HUD agents in HUD layout */}
        <Route path="/*" element={
          <HudLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/complaint" replace />} />
              <Route path="/complaint" element={<ComplaintAgent />} />
              <Route path="/ngo" element={<NgoAgent />} />
              <Route path="/hospital" element={<HospitalAgent />} />
              <Route path="/admin" element={<AdminAgent />} />
            </Routes>
          </HudLayout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
