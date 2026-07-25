import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  const isUploader = Boolean(token && user && (user.role === 'uploader' || user.role === 'admin'));

  const [totalPermits, setTotalPermits] = useState(0);
  const [purposeBreakdown, setPurposeBreakdown] = useState({});
  const [recentPermits, setRecentPermits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, permitsRes] = await Promise.all([
          fetch("https://nipma-bpms-backend.onrender.com/api/permits/stats"),
          fetch("https://nipma-bpms-backend.onrender.com/api/permits")
        ]);

        const statsData = await statsRes.json();
        const permitsData = await permitsRes.json();
        
        if (statsData.success) {
          setTotalPermits(statsData.total);
        }

        if (permitsData.success) {
          const allPermits = permitsData.data;
          setRecentPermits(allPermits.slice(0, 5));

          // Calculate purpose breakdown
          const breakdown = {};
          allPermits.forEach(p => {
            const purpose = p.purpose || 'RESIDENTIAL';
            breakdown[purpose] = (breakdown[purpose] || 0) + 1;
          });
          setPurposeBreakdown(breakdown);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">NiPDA Archive Control</h1>
        <p className="text-gray-500 mt-2">Welcome to the Building Permit Management System.</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/permits/historical" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col hover:border-blue-400 hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Total Archived</h2>
            <span className="text-blue-600 bg-blue-50 p-2 rounded-lg text-xl">📁</span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-gray-900">{totalPermits}</span>
          </div>
          <p className="text-xs text-green-600 font-medium mt-2 flex items-center justify-between">
            <span>✓ Safely secured in vault</span>
            <span className="text-blue-600 font-bold">View List →</span>
          </p>
        </Link>

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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Security Status</h2>
            <span className="text-yellow-600 bg-yellow-50 p-2 rounded-lg text-xl">🛡️</span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-gray-900">{isUploader ? 'Authenticated' : 'Public Access'}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {isUploader ? `Officer: ${user?.name}` : 'Public view mode'}
          </p>
        </div>
      </div>

      {/* VISUAL ANALYTICS BREAKDOWN */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Permits Breakdown by Category</h2>
        {totalPermits > 0 ? (
          <div className="space-y-3">
            {Object.entries(purposeBreakdown).map(([purpose, count]) => {
              const percentage = Math.round((count / totalPermits) * 100);
              return (
                <div key={purpose} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>{purpose}</span>
                    <span>{count} permits ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-2">No category data available yet.</p>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isUploader && (
            <Link to="/permits/new" className="group flex items-center p-6 bg-blue-600 rounded-xl shadow-sm hover:bg-blue-700 transition">
              <div className="bg-blue-500 text-white p-4 rounded-full mr-4 group-hover:scale-110 transition-transform">➕</div>
              <div>
                <h3 className="text-lg font-bold text-white">Archive New Permit</h3>
                <p className="text-blue-100 text-sm">Scan and digitize a historical physical file</p>
              </div>
            </Link>
          )}

          <Link to="/permits/historical" className="group flex items-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-400 hover:shadow-md transition">
            <div className="bg-gray-100 text-blue-600 p-4 rounded-full mr-4 group-hover:bg-blue-50 transition-colors">🔍</div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Search Records</h3>
              <p className="text-gray-500 text-sm">Find and view archived documents</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;