import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import NewPermit from './pages/NewPermit';
import PermitList from './pages/PermitList';
import Login from './Login'; // Single Login component

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 w-full overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/permits/new" element={<NewPermit />} />
            <Route path="/permits/historical" element={<PermitList />} />
            <Route path="/vault-admin" element={<Login />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;