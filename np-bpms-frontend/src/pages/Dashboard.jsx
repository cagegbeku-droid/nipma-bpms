
import React, { useEffect, useState } from 'react';
import { ArchiveBoxIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState({ total_archived: 0 });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, chartRes] = await Promise.all([
          fetch("https://nipma-bpms-backend.onrender.com/api/permits/stats"),
          fetch("https://nipma-bpms-backend.onrender.com/api/permits/monthly-stats")
        ]);
        
        const statsData = await statsRes.json();
        const chartJson = await chartRes.json();

        if (statsData.success) setStats(statsData.data);
        if (chartJson.success) setChartData(chartJson.data);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Archival System Overview</h1>
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center">
          <div className="p-4 rounded-full bg-blue-500 mr-4">
            <ArchiveBoxIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Archived Records</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total_archived}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center">
          <div className="p-4 rounded-full bg-green-500 mr-4">
            <CheckCircleIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">System Status</p>
            <p className="text-xl font-bold text-gray-900">Online & Secure</p>
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Archival Trends (Uploads per Month)</h2>
        <div className="h-80 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                <Bar dataKey="Archived" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400 italic">Not enough data to generate chart yet.</div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
