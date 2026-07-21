import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import NewPermit from './pages/NewPermit';
import PermitList from './pages/PermitList';
import AdminLogin from './pages/AdminLogin'; // <-- Import the secret login page

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 w-full overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            
            {/* The Ghost Route: Protects itself by kicking out logged-out users */}
            <Route path="/permits/new" element={<NewPermit />} />
            
            {/* The Public Registry: Adapts based on whether you are logged in */}
            <Route path="/permits/historical" element={<PermitList />} />
            
            {/* THE SECRET DOOR: No buttons point here. You must manually type the URL! */}
            <Route path="/vault-admin" element={<AdminLogin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;