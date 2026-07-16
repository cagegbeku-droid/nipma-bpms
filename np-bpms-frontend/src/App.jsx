
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import NewPermit from './pages/NewPermit';
import PermitList from './pages/PermitList';

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 w-full overflow-y-auto">
          <Routes>
            {/* Notice how these now safely use the double brackets! */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/permits/new" element={<NewPermit />} />
            <Route path="/permits/historical" element={<PermitList />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
