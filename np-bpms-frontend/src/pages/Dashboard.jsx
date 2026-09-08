import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const PURPOSE_COLORS = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];

const Dashboard = () => {
  const navigate = useNavigate();

  // --- JWT OFFICER / ADMIN CHECK ---
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const savedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  
  const roleStr = (user?.role || '').toLowerCase();
  const isUploader = Boolean(
    token && user && (
      !user.role || 
      roleStr === 'uploader' || 
      roleStr === 'admin' || 
      roleStr === 'officer' || 
      roleStr === 'staff'
    )
  );

  const [totalPermits, setTotalPermits] = useState(0);
  const [recentPermits, setRecentPermits] = useState([]);
  const [residentialCount, setResidentialCount] = useState(0);
  const [commercialCount, setCommercialCount] = useState(0);
  const [zonesCount, setZonesCount] = useState(0);
  const [trendData, setTrendData] = useState([]);
  const [purposeData, setPurposeData] = useState([]);
  const [quickSearch, setQuickSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
          setTotalPermits(statsData.total || (Array.isArray(permitsData.data) ? permitsData.data.length : 0));
        } else {
          setError("Unable to load summary statistics.");
        }

        if (permitsData.success && Array.isArray(permitsData.data)) {
          const records = permitsData.data;
          setRecentPermits(records.slice(0, 6));

          const resCount = records.filter(p => (p.purpose || '').toUpperCase().includes('RESIDENTIAL')).length;
          const commCount = records.filter(p => {
            const purp = (p.purpose || '').toUpperCase();
            return purp.includes('COMMERCIAL') || purp.includes('INDUSTRIAL') || purp.includes('CIVIC') || purp.includes('INSTITUTIONAL');
          }).length;
          const uniqueLocations = new Set(records.map(p => (p.location || '').trim().toUpperCase()).filter(Boolean)).size;

          setResidentialCount(resCount);
          setCommercialCount(commCount || (records.length - resCount));
          setZonesCount(uniqueLocations || 1);

          // Build Purpose Distribution Data
          const purposeMap = {};
          const monthlyMap = {};

          records.forEach(p => {
            let rawPurp = (p.purpose || 'RESIDENTIAL').toUpperCase().trim();
            let normPurp = 'Other';
            if (rawPurp.includes('RESID')) normPurp = 'Residential';
            else if (rawPurp.includes('COMM')) normPurp = 'Commercial';
            else if (rawPurp.includes('INDUS')) normPurp = 'Industrial';
            else if (rawPurp.includes('CIVIC') || rawPurp.includes('INSTIT')) normPurp = 'Civic / Public';
            else if (rawPurp.includes('MIXED')) normPurp = 'Mixed-Use';
            else if (rawPurp) normPurp = rawPurp.charAt(0).toUpperCase() + rawPurp.slice(1).toLowerCase();

            purposeMap[normPurp] = (purposeMap[normPurp] || 0) + 1;

            if (p.date_issued) {
              const cleanDate = String(p.date_issued).split('T')[0];
              const match = cleanDate.match(/^(\d{4})[-/](\d{1,2})/);
              if (match) {
                const ym = `${match[1]}-${match[2].padStart(2, '0')}`;
                monthlyMap[ym] = (monthlyMap[ym] || 0) + 1;
              }
            }
          });

          const pData = Object.keys(purposeMap).map(name => ({
            name,
            value: purposeMap[name]
          })).sort((a, b) => b.value - a.value);
          setPurposeData(pData);

          const sortedMonths = Object.keys(monthlyMap).sort();
          const recentMonths = sortedMonths.slice(-7);
          const tData = recentMonths.map(ym => {
            const [y, m] = ym.split('-');
            const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
            const label = !isNaN(dateObj.getTime())
              ? dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
              : ym;
            return {
              period: label,
              count: monthlyMap[ym]
            };
          });
          setTrendData(tData);
        }
      } catch (err) {
        setError("Unable to retrieve records at this time. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleQuickSearch = (e) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      navigate(`/permits/historical?search=${encodeURIComponent(quickSearch.trim())}`);
    } else {
      navigate('/permits/historical');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header Section with Quick Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
            Building Permit Records Management System
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Official Registry & Digital Archive Dashboard</p>
        </div>

        {/* Quick Search Bar */}
        <form onSubmit={handleQuickSearch} className="relative w-full lg:w-96">
          <input
            type="text"
            placeholder="Quick lookup by permit #, applicant..."
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            className="w-full pl-9 pr-24 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-xs"
          />
          <span className="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Archived */}
        <Link 
          to="/permits/historical" 
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Total Archived</h2>
              <span className="text-blue-600 bg-blue-50 p-2 rounded-lg text-lg">📁</span>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3"></div>
              ) : error ? (
                <span className="text-red-500 text-xs font-medium">{error}</span>
              ) : (
                <span className="text-3xl font-extrabold text-gray-900">{totalPermits}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-blue-600 font-medium mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
            <span>Official Records Indexed</span>
            <span className="font-bold group-hover:translate-x-0.5 transition-transform">View All →</span>
          </p>
        </Link>

        {/* Card 2: Residential Permits */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Residential</h2>
              <span className="text-emerald-600 bg-emerald-50 p-2 rounded-lg text-lg">🏡</span>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3"></div>
              ) : (
                <span className="text-3xl font-extrabold text-gray-900">{residentialCount}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-2">Residential Housing Permits</p>
        </div>

        {/* Card 3: Commercial & Other */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Commercial & Civic</h2>
              <span className="text-purple-600 bg-purple-50 p-2 rounded-lg text-lg">🏢</span>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3"></div>
              ) : (
                <span className="text-3xl font-extrabold text-gray-900">{commercialCount}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-2">Business & Civic Structures</p>
        </div>

        {/* Card 4: Municipal Communities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Communities</h2>
              <span className="text-amber-600 bg-amber-50 p-2 rounded-lg text-lg">📍</span>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3"></div>
              ) : (
                <span className="text-3xl font-extrabold text-gray-900">{zonesCount}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-2">Registered District Zones</p>
        </div>

      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Permits Registration Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Permit Registration Trends</h3>
              <p className="text-xs text-gray-500 mt-0.5">Monthly archive issuance volumes</p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-md">
              Monthly Volume
            </span>
          </div>

          <div className="h-64 w-full">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg animate-pulse text-xs text-gray-400">
                Loading analytics...
              </div>
            ) : trendData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg text-xs text-gray-500">
                Not enough date records to plot trend
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="period" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="count" name="Permits Registered" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Development Purpose Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-900">Category Distribution</h3>
            <p className="text-xs text-gray-500 mt-0.5">Breakdown by development purpose</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg animate-pulse text-xs text-gray-400">
                Loading categories...
              </div>
            ) : purposeData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg text-xs text-gray-500">
                No category data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={purposeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {purposeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PURPOSE_COLORS[index % PURPOSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Quick Actions Section */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className={`grid grid-cols-1 ${isUploader ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-5`}>
          
          {/* UPLOAD ACTION: VISIBLE ONLY TO AUTHENTICATED OFFICERS */}
          {isUploader && (
            <Link 
              to="/permits/new" 
              className="group flex items-center p-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-sm hover:shadow-md hover:from-blue-700 hover:to-indigo-800 transition-all border border-blue-500/20"
            >
              <div className="bg-white/15 text-white p-4 rounded-xl mr-4 group-hover:scale-105 transition-transform text-2xl">
                ➕
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Archive New Permit</h3>
                <p className="text-blue-100 text-sm mt-0.5">Digitize, catalog, and record a physical permit file</p>
              </div>
            </Link>
          )}

          {/* PUBLIC SEARCH ACTION: VISIBLE TO EVERYONE */}
          <Link 
            to="/permits/historical" 
            className="group flex items-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="bg-blue-50 text-blue-600 p-4 rounded-xl mr-4 group-hover:bg-blue-100 transition-colors text-2xl">
              🔍
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Search & Browse Registry</h3>
              <p className="text-gray-500 text-sm mt-0.5">Search permits by number, applicant name, community, or date</p>
            </div>
          </Link>

        </div>
      </div>

      {/* RECENT ARCHIVES SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Archived Records</h2>
            <p className="text-xs text-gray-500 mt-0.5">Latest official permits indexed in the registry</p>
          </div>
          <Link 
            to="/permits/historical" 
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            <span>View All Records in Registry</span>
            <span>→</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="animate-pulse h-12 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        ) : recentPermits.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-3xl mb-2 inline-block">📂</span>
            <p className="text-sm font-medium text-gray-600">No permits archived yet.</p>
            <p className="text-xs text-gray-400 mt-1">Archived records will appear here as they are entered.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50/70">
                  <th className="py-3 px-4 rounded-l-lg">Permit Number</th>
                  <th className="py-3 px-4">Applicant / Entity</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {recentPermits.map(permit => {
                  const isArchived = permit.status === 'Synced' || permit.upload_status === 'completed' || permit.status === 'Archived';
                  const purpose = (permit.purpose || 'RESIDENTIAL').toUpperCase();
                  const isResidential = purpose.includes('RESIDENTIAL');

                  return (
                    <tr key={permit.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="py-3.5 px-4 font-bold text-gray-900 font-mono tracking-tight">
                        {permit.permit_number}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-900 uppercase">
                        {permit.applicant_name || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                          isResidential 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {permit.purpose || 'RESIDENTIAL'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 uppercase text-gray-600">
                        {permit.location || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${
                          isArchived 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isArchived ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          {isArchived ? 'Archived' : 'In Review'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link 
                          to="/permits/historical"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                        >
                          View Record →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;