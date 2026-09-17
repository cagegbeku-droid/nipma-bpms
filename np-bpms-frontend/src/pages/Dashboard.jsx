import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
    if (isUploader) {
      if (quickSearch.trim()) {
        navigate(`/permits/historical?search=${encodeURIComponent(quickSearch.trim())}`);
      } else {
        navigate('/permits/historical');
      }
    } else {
      navigate('/analytics');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header Section with Quick Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Building Permit Records Management System
          </h1>
        </div>

        {/* Quick Search Bar */}
        <form onSubmit={handleQuickSearch} className="relative w-full lg:w-96">
          <input
            type="text"
            placeholder={isUploader ? "Quick search permits..." : "Search in analytics..."}
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            className="w-full pl-9 pr-24 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-xs"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Overview Cards (Clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Archived */}
        <Link 
          to={isUploader ? "/permits/historical" : "/analytics"}
          className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all group"
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
            <span>Official Records</span>
            <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
          </p>
        </Link>

        {/* Card 2: Residential Permits - Clickable */}
        <Link 
          to={isUploader ? "/permits/historical?purpose=RESIDENTIAL" : "/analytics"}
          className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex flex-col justify-between hover:border-emerald-400 hover:shadow-md transition-all group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Residential</h2>
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
          <p className="text-xs text-gray-500 group-hover:text-emerald-600 mt-3 border-t border-gray-100 pt-2 flex items-center justify-between transition-colors">
            <span>Residential Housing Permits</span>
            <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
          </p>
        </Link>

        {/* Card 3: Commercial & Civic - Clickable */}
        <Link 
          to={isUploader ? "/permits/historical?purpose=COMMERCIAL" : "/analytics"}
          className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex flex-col justify-between hover:border-purple-400 hover:shadow-md transition-all group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-purple-600 transition-colors">Commercial & Civic</h2>
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
          <p className="text-xs text-gray-500 group-hover:text-purple-600 mt-3 border-t border-gray-100 pt-2 flex items-center justify-between transition-colors">
            <span>Business & Civic Structures</span>
            <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
          </p>
        </Link>

        {/* Card 4: Municipal Communities - Clickable */}
        <Link 
          to="/analytics"
          className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition-all group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Communities</h2>
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
          <p className="text-xs text-gray-500 group-hover:text-amber-600 mt-3 border-t border-gray-100 pt-2 flex items-center justify-between transition-colors">
            <span>Registered District Zones</span>
            <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
          </p>
        </Link>

      </div>

      {/* Quick Actions Section */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {isUploader ? (
            <>
              {/* OFFICER UPLOAD ACTION */}
              <Link 
                to="/permits/new" 
                className="group flex items-center p-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-xs hover:shadow-md hover:from-blue-700 hover:to-indigo-800 transition-all border border-blue-500/20"
              >
                <div className="bg-white/15 text-white p-3.5 rounded-xl mr-4 group-hover:scale-105 transition-transform text-2xl">
                  ➕
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Archive New Permit</h3>
                </div>
              </Link>

              {/* OFFICER REGISTRY ACTION */}
              <Link 
                to="/permits/historical" 
                className="group flex items-center p-6 bg-white border border-gray-200 rounded-xl shadow-xs hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl mr-4 group-hover:bg-blue-100 transition-colors text-2xl">
                  📁
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Search & Manage Registry</h3>
                </div>
              </Link>
            </>
          ) : (
            <>
              {/* PUBLIC ANALYTICS ACTION */}
              <Link 
                to="/analytics" 
                className="group flex items-center p-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-xs hover:shadow-md hover:from-blue-700 hover:to-indigo-800 transition-all border border-blue-500/20"
              >
                <div className="bg-white/15 text-white p-3.5 rounded-xl mr-4 group-hover:scale-105 transition-transform text-2xl">
                  📊
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">View Analytics & Trends</h3>
                </div>
              </Link>

              {/* PUBLIC OFFICER PORTAL ACTION */}
              <Link 
                to="/vault-admin" 
                className="group flex items-center p-6 bg-white border border-gray-200 rounded-xl shadow-xs hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl mr-4 group-hover:bg-blue-100 transition-colors text-2xl">
                  🔐
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Officer Portal Login</h3>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* RECENT RECORDS SECTION */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Records</h2>
          </div>
          {isUploader ? (
            <Link 
              to="/permits/historical" 
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <span>View All Registry</span>
              <span>→</span>
            </Link>
          ) : (
            <Link 
              to="/analytics" 
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <span>View Full Analytics</span>
              <span>→</span>
            </Link>
          )}
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
                  <th className="py-3 px-4 text-right rounded-r-lg">Status</th>
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
                      <td className="py-3.5 px-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${
                          isArchived 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isArchived ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          {isArchived ? 'Archived' : 'In Review'}
                        </span>
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