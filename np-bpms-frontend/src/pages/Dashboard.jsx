import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  // --- INVISIBLE ADMIN CHECK ---
  const isAdmin = localStorage.getItem('x-admin-key') === 'supersecret123';

  const [totalPermits, setTotalPermits] = useState(0);
  const [recentPermits, setRecentPermits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch stats and permits in parallel
        const [statsRes, permitsRes] = await Promise.all([
          fetch("https://nipma-bpms-backend.onrender.com/api/permits/stats"),
          fetch("https://nipma-bpms-backend.onrender.com/api/permits")
        ]);

        const statsData = await statsRes.json();
        const permitsData = await permitsRes.json();
        
        if (statsData.success) {
          setTotalPermits(statsData.total);
        } else {
          setError("Failed to load statistics.");
        }

        if (permitsData.success) {
          // Grab only the latest 5 records for the recent upload section
          setRecentPermits(permitsData.data.slice(0, 5));
        }
      } catch (err) {
        setError("Database connection error.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">NiPDA Archive Control</h1>
        <p className="text-gray-500 mt-2">Welcome to the Building Permit Management System.</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Total Archived (Clickable to redirect to permit list) */}
        <Link to="/permits/historical" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col hover:border-blue-400 hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Total Archived</h2>
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
          <p className="text-xs text-green-600 font-medium mt-2 flex items-center justify-between">
            <span>✓ Safely secured in vault</span>
            <span className="text-blue-600 opacity-0 group-hover:opacity-150 transition-opacity font-bold">View List →</span>
          </p>
        </Link>

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

        {/* Card 3: Security Alerts */}
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
      <div>
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

      {/* --- RECENT UPLOADS SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Archives</h2>
          <Link to="/permits/historical" className="text-sm font-semibold text-blue-600 hover:underline">View All Records →</Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="animate-pulse h-12 bg-gray-100 rounded-md"></div>
            ))}
          </div>
        ) : recentPermits.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No permits archived yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs font-bold text-gray-500 uppercase">
                  <th className="py-3 px-4">Permit Number</th>
                  <th className="py-3 px-4">Applicant Name</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm text-gray-700">
                {recentPermits.map(permit => (
                  <tr key={permit.id} className="hover:bg-gray-50 transition">
                    <td className="py-3 px-4 font-bold text-gray-900">{permit.permit_number}</td>
                    <td className="py-3 px-4 uppercase">{permit.applicant_name}</td>
                    <td className="py-3 px-4">
                      <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-md font-medium">
                        {permit.purpose || 'RESIDENTIAL'}
                      </span>
                    </td>
                    <td className="py-3 px-4 uppercase">{permit.location}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        permit.upload_status === 'completed' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {permit.upload_status === 'completed' ? 'Synced' : 'Processing'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;