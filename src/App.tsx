import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Sequences from './pages/Sequences';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import ColdCalling from './pages/ColdCalling';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sequences" element={<Sequences />} />
              <Route path="/cold-calling" element={<ColdCalling />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App