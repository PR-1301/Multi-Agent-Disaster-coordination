import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HudLayout from './components/hud/HudLayout';
import ComplaintAgent from './pages/ComplaintAgent';
import NgoAgent from './pages/NgoAgent';
import HospitalAgent from './pages/HospitalAgent';
import AdminAgent from './pages/AdminAgent';
import { useMockData } from './hooks/useMockData';

function App() {
  const { complaints, ngos, hospitals, admin, addTestComplaint } = useMockData();

  return (
    <Router>
      <HudLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/complaint" replace />} />
          <Route path="/complaint" element={<ComplaintAgent data={complaints} onAddComplaint={addTestComplaint} />} />
          <Route path="/ngo" element={<NgoAgent data={ngos} />} />
          <Route path="/hospital" element={<HospitalAgent data={hospitals} />} />
          <Route path="/admin" element={<AdminAgent data={admin} />} />
        </Routes>
      </HudLayout>
    </Router>
  );
}

export default App;
