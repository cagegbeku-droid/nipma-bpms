import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  // --- INVISIBLE ADMIN CHECK ---
  const isAdmin = localStorage.getItem('x-admin-key') === 'supersecret123';

  const [totalPermits, setTotalPermits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/stats");
        const data = await response.json();
        
        if (data.success) {
          setTotalPermits(data.total);
        } else {
          setError("Failed to load statistics.");
        }
      } catch (err) {
        setError("Database connection error.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">NiPDA Archive Control</h1>
        <p className="text-gray-500 mt-2">Welcome to the Building Permit Management System.</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* Card 1: Total Archived */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Archived</h2>
            <span className="text-blue-600 bg-blue-50 p-2 rounded-lg text-xl">📁</span>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3"></div>
            ) : error ? (
              <span className="text-red-500 text-sm font-medium">{error}</span>
            ) : (
              <span className="text-4xl font-extrabold text-gray-900">{totalPermits}</span>
            )}
          </div>
          <p className="text-xs text-green-600 font-medium mt-2">✓ Safely secured in vault</p>
        </div>

        {/* Card 2: System Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Cloud Storage</h2>
            <span className="text-green-600 bg-green-50 p-2 rounded-lg text-xl">☁️</span>
          </div>
          <div className="mt-4 flex items-center">
            <span className="h-3 w-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            <span className="text-2xl font-bold text-gray-900">Online</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Google Drive & Supabase synced</p>
        </div>

        {/* Card 3: Pending Tasks (Placeholder for future) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Security Alerts</h2>
            <span className="text-yellow-600 bg-yellow-50 p-2 rounded-lg text-xl">🛡️</span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">System operating normally</p>
        </div>
      </div>

      {/* Quick Actions Section */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* --- SECRET UPLOAD ACTION: ONLY VISIBLE TO YOU --- */}
        {isAdmin && (
          <Link to="/permits/new" className="group flex items-center p-6 bg-blue-600 rounded-xl shadow-sm hover:bg-blue-700 transition">
            <div className="bg-blue-500 text-white p-4 rounded-full mr-4 group-hover:scale-110 transition-transform">
              ➕
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Archive New Permit</h3>
              <p className="text-blue-100 text-sm">Scan and digitize a historical physical file</p>
            </div>
          </Link>
        )}

        {/* PUBLIC SEARCH ACTION: VISIBLE TO EVERYONE */}
        <Link to="/permits/historical" className="group flex items-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-400 hover:shadow-md transition">
          <div className="bg-gray-100 text-blue-600 p-4 rounded-full mr-4 group-hover:bg-blue-50 transition-colors">
            🔍
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Search Records</h3>
            <p className="text-gray-500 text-sm">Find and view archived documents</p>
          </div>
        </Link>

      </div>
    </div>
  );
};

export default Dashboard;