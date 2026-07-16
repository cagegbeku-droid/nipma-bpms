import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const MainLayout = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center px-6 justify-between">
          <h2 className="text-lg font-semibold text-gray-700">NiPMA	    Building Permit Archive</h2>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-600">Admin User</span>
            <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">A</div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default MainLayout;