import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import NewPermit from './pages/NewPermit';
import PermitList from './pages/PermitList';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="permits/new" element={<NewPermit />} />
          <Route path="permits/historical" element={<PermitList />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;