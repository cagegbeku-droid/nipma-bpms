import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import SessionTimer from './components/layout/SessionTimer';
import Dashboard from './pages/Dashboard';
import NewPermit from './pages/NewPermit';
import PermitList from './pages/PermitList';
import VerifyPermit from './pages/VerifyPermit';
import Login from './Login';

// Layout wrapper to conditionally hide officer sidebar on public verification page
const AppLayout = ({ children }) => {
  const location = useLocation();
  const isPublicVerification = location.pathname === '/verify-permit';

  if (isPublicVerification) {
    return <main className="flex-1 w-full min-h-screen">{children}</main>;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 w-full overflow-y-auto">
        <SessionTimer />
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/permits/new" element={<NewPermit />} />
          <Route path="/permits/historical" element={<PermitList />} />
          <Route path="/vault-admin" element={<Login />} />
          
          {/* PUBLIC PERMIT VERIFICATION ROUTE */}
          <Route path="/verify-permit" element={<VerifyPermit />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;