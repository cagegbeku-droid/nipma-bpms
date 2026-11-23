import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
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

const PURPOSE_COLORS = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1'];

const Analytics = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Read instant cached permits from localStorage for 0ms initial load time
  const cachedPermits = useMemo(() => {
    try {
      const saved = localStorage.getItem('bpms_cached_permits');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const cachedStats = useMemo(() => {
    try {
      const saved = localStorage.getItem('bpms_cached_dashboard');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const [permits, setPermits] = useState(cachedPermits || []);
  const [stats, setStats] = useState(cachedStats || null);
  const [isLoading, setIsLoading] = useState(!cachedPermits || cachedPermits.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('ALL'); // 'ALL', '12M', '6M'

  // Communities State & Controls
  const [communitySearch, setCommunitySearch] = useState('');
  const [communitySort, setCommunitySort] = useState('count'); // 'count' | 'alpha'
  const [showAllCommunities, setShowAllCommunities] = useState(true);

  // Smooth scroll to #communities-section when hash is present
  useEffect(() => {
    if (location.hash === '#communities-section' || window.location.hash === '#communities-section') {
      const timer = setTimeout(() => {
        const el = document.getElementById('communities-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setIsSyncing(true);
        const [permitsRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/permits?_t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache' }
          }),
          fetch(`${API_BASE_URL}/api/permits/stats?_t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache' }
          }).catch(() => null)
        ]);

        const permitsData = await permitsRes.json();
        if (permitsData.success && Array.isArray(permitsData.data)) {
          setPermits(permitsData.data);
          setError('');
          try {
            localStorage.setItem('bpms_cached_permits', JSON.stringify(permitsData.data));
          } catch (e) {
            console.warn("Could not cache permits:", e);
          }
        } else if (!cachedPermits || cachedPermits.length === 0) {
          setError("Failed to load records.");
        }

        if (statsRes && statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.success) {
            setStats(statsData);
            try {
              localStorage.setItem('bpms_cached_dashboard', JSON.stringify(statsData));
            } catch (e) {
              console.warn("Could not cache stats:", e);
            }
          }
        }
      } catch (err) {
        if (!cachedPermits || cachedPermits.length === 0) {
          setError("Unable to connect to records registry.");
        }
      } finally {
        setIsLoading(false);
        setIsSyncing(false);
      }
    };

    fetchRecords();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchRecords();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    const syncInterval = setInterval(() => {
      fetchRecords();
    }, 25000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(syncInterval);
    };
  }, []);

  // Filter records based on selected time range
  const filteredRecords = useMemo(() => {
    if (timeRange === 'ALL') return permits;
    const now = new Date();
    const monthsLimit = timeRange === '6M' ? 6 : 12;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsLimit, 1);

    return permits.filter(p => {
      if (!p.date_issued) return false;
      const cleanDate = String(p.date_issued).split('T')[0];
      const pDate = new Date(cleanDate);
      return !isNaN(pDate.getTime()) && pDate >= cutoff;
    });
  }, [permits, timeRange]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = filteredRecords.length > 0 ? filteredRecords.length : (stats?.total || permits.length || 0);
    if (total === 0) {
      return {
        total: 0,
        residential: 0,
        commercial: 0,
        zonesCount: 0,
        resPercent: '0%',
        commPercent: '0%',
        avgMonthly: 0
      };
    }

    const residential = filteredRecords.filter(p => (p.purpose || '').toUpperCase().includes('RESIDENTIAL')).length;
    const commercial = filteredRecords.filter(p => {
      const purp = (p.purpose || '').toUpperCase();
      return purp.includes('COMMERCIAL') || purp.includes('CIVIC') || purp.includes('INSTITUT') || purp.includes('ORGANIZ') || purp.includes('INDUSTRIAL');
    }).length;

    const uniqueLocations = new Set(
      filteredRecords
        .map(p => (p.location || '').trim().toUpperCase())
        .filter(l => l && l !== 'N/A')
    ).size;

    const resPercent = `${Math.round((residential / total) * 100)}%`;
    const commPercent = `${Math.round((commercial / total) * 100)}%`;

    // Monthly average
    const monthsSet = new Set();
    filteredRecords.forEach(p => {
      if (p.date_issued) {
        const ym = String(p.date_issued).slice(0, 7);
        if (ym) monthsSet.add(ym);
      }
    });
    const avgMonthly = monthsSet.size > 0 ? Math.round(total / monthsSet.size) : total;

    return {
      total,
      residential: residential || stats?.residential || 0,
      commercial: commercial || (total - residential),
      zonesCount: uniqueLocations || stats?.zones || 1,
      resPercent,
      commPercent,
      avgMonthly
    };
  }, [filteredRecords, permits.length, stats]);

  // Monthly Trend Data
  const trendData = useMemo(() => {
    const monthlyMap = {};
    filteredRecords.forEach(p => {
      if (p.date_issued) {
        const cleanDate = String(p.date_issued).split('T')[0];
        const match = cleanDate.match(/^(\d{4})[-/](\d{1,2})/);
        if (match) {
          const ym = `${match[1]}-${match[2].padStart(2, '0')}`;
          monthlyMap[ym] = (monthlyMap[ym] || 0) + 1;
        }
      }
    });

    const sortedMonths = Object.keys(monthlyMap).sort();
    const slicedMonths = timeRange === '6M' ? sortedMonths.slice(-6) : timeRange === '12M' ? sortedMonths.slice(-12) : sortedMonths;

    return slicedMonths.map(ym => {
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
  }, [filteredRecords, timeRange]);

  // Purpose Distribution Data
  const purposeData = useMemo(() => {
    const purposeMap = {};
    filteredRecords.forEach(p => {
      let rawPurp = (p.purpose || 'RESIDENTIAL').toUpperCase().trim();
      let normPurp = 'Other';
      if (rawPurp.includes('RESID')) normPurp = 'Residential';
      else if (rawPurp.includes('COMM')) normPurp = 'Commercial';
      else if (rawPurp.includes('INDUS')) normPurp = 'Industrial';
      else if (rawPurp.includes('CIVIC') || rawPurp.includes('INSTIT')) normPurp = 'Civic';
      else if (rawPurp.includes('MIXED')) normPurp = 'Mixed-Use';
      else if (rawPurp) normPurp = rawPurp.charAt(0).toUpperCase() + rawPurp.slice(1).toLowerCase();

      purposeMap[normPurp] = (purposeMap[normPurp] || 0) + 1;
    });

    return Object.keys(purposeMap)
      .map(name => ({
        name,
        value: purposeMap[name]
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRecords]);

  // All Registered District Community Zones (Full List)
  const allCommunities = useMemo(() => {
    const locMap = {};
    filteredRecords.forEach(p => {
      const loc = (p.location || '').trim().toUpperCase();
      if (loc && loc !== 'N/A') {
        locMap[loc] = (locMap[loc] || 0) + 1;
      }
    });

    const totalCount = filteredRecords.length || 1;

    return Object.keys(locMap)
      .map(name => ({
        name,
        count: locMap[name],
        percent: Math.round((locMap[name] / totalCount) * 100)
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [filteredRecords]);

  // Filtered & Sorted Communities for Display
  const displayedCommunities = useMemo(() => {
    let list = allCommunities;

    if (communitySearch.trim()) {
      const q = communitySearch.toLowerCase().trim();
      list = list.filter(item => item.name.toLowerCase().includes(q));
    }

    if (communitySort === 'alpha') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list = [...list].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }

    if (!showAllCommunities) {
      return list.slice(0, 12);
    }

    return list;
  }, [allCommunities, communitySearch, communitySort, showAllCommunities]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              Analytics & District Intelligence
            </h1>
            {isSyncing && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 animate-pulse border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                Syncing Live
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Real-time analytics across all {metrics.total} official archived building permits in Ningo-Prampram District.
          </p>
        </div>

        {/* Timeframe Filter Pill Tabs */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 self-start sm:self-auto">
          <button
            onClick={() => setTimeRange('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              timeRange === 'ALL'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Time ({permits.length || stats?.total || 1020})
          </button>
          <button
            onClick={() => setTimeRange('12M')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              timeRange === '12M'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            12 Months
          </button>
          <button
            onClick={() => setTimeRange('6M')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              timeRange === '6M'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            6 Months
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Archived Card */}
        <Link 
          to="/permits/historical" 
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
                <span className="text-3xl font-extrabold text-gray-900">{metrics.total}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-blue-600 font-medium mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
            <span>Official Records</span>
            <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
          </p>
        </Link>

        {/* Residential Housing Card - Clickable */}
        <Link
          to="/permits/historical?purpose=RESIDENTIAL"
          className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex flex-col justify-between hover:border-emerald-400 hover:shadow-md transition-all group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Residential</h2>
              <span className="text-emerald-600 bg-emerald-50 p-2 rounded-lg text-lg">🏡</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3"></div>
              ) : (
                <>
                  <span className="text-3xl font-extrabold text-gray-900">{metrics.residential}</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{metrics.resPercent}</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 group-hover:text-emerald-600 mt-3 border-t border-gray-100 pt-2 flex items-center justify-between transition-colors">
            <span>Residential Housing Permits</span>
            <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
          </p>
        </Link>

        {/* Commercial & Civic Card - Clickable */}
        <Link
          to="/permits/historical?purpose=COMMERCIAL"
          className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex flex-col justify-between hover:border-purple-400 hover:shadow-md transition-all group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-purple-600 transition-colors">Commercial & Civic</h2>
              <span className="text-purple-600 bg-purple-50 p-2 rounded-lg text-lg">🏢</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              {isLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3"></div>
              ) : (
                <>
                  <span className="text-3xl font-extrabold text-gray-900">{metrics.commercial}</span>
                  <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{metrics.commPercent}</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 group-hover:text-purple-600 mt-3 border-t border-gray-100 pt-2 flex items-center justify-between transition-colors">
            <span>Business & Civic Structures</span>
            <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
          </p>
        </Link>

        {/* Communities Card - Clickable */}
        <div 
          onClick={() => {
            const el = document.getElementById('communities-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
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
                <span className="text-3xl font-extrabold text-gray-900">{metrics.zonesCount}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 group-hover:text-amber-600 mt-3 border-t border-gray-100 pt-2 flex items-center justify-between transition-colors">
            <span>Registered District Zones</span>
            <span className="font-bold group-hover:translate-x-0.5 transition-transform">↓</span>
          </p>
        </div>

      </div>

      {/* Row 1: Charts (Trends & Category Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-gray-200 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Registration Trends</h3>
              <p className="text-xs text-gray-500 mt-0.5">Historical issuance activity over time</p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-md">
              Monthly
            </span>
          </div>

          <div className="h-72 w-full">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg animate-pulse text-xs text-gray-400">
                Loading...
              </div>
            ) : trendData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg text-xs text-gray-500">
                No date records to display
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
                  <Bar dataKey="count" name="Permits" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-900">Category Breakdown</h3>
            <p className="text-xs text-gray-500 mt-0.5">Distribution by development purpose</p>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg animate-pulse text-xs text-gray-400">
                Loading...
              </div>
            ) : purposeData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg text-xs text-gray-500">
                No category data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={purposeData}
                    cx="50%"
                    cy="45%"
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

      {/* Row 2: Communities & Zones Section (Full District Coverage) */}
      <div id="communities-section" className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-5">
        
        {/* Header & Filter Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 tracking-tight">Communities & Zones</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {allCommunities.length} Registered District Zones
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Complete municipal directory across Ningo-Prampram District. Select any community card to filter permits in the registry.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
            {/* Quick Community Search */}
            <div className="relative flex-1 sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={communitySearch}
                onChange={(e) => setCommunitySearch(e.target.value)}
                placeholder="Search community name..."
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
              {communitySearch && (
                <button
                  type="button"
                  onClick={() => setCommunitySearch('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Toggle */}
            <select
              value={communitySort}
              onChange={(e) => setCommunitySort(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="count">Sort: Most Permits</option>
              <option value="alpha">Sort: A to Z</option>
            </select>

            {/* View Mode Toggle */}
            {allCommunities.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllCommunities(!showAllCommunities)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer border ${
                  showAllCommunities
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {showAllCommunities ? `Showing All (${allCommunities.length})` : 'Show All Zones'}
              </button>
            )}

            <Link
              to="/permits/historical"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 ml-auto lg:ml-0"
            >
              <span>View in Registry</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Communities Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
              <div key={n} className="animate-pulse h-20 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        ) : displayedCommunities.length === 0 ? (
          <div className="text-center py-10 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <span className="text-2xl mb-2 block">📍</span>
            <p className="text-xs font-medium text-gray-600">
              {communitySearch ? `No community zones match "${communitySearch}"` : 'No community data recorded.'}
            </p>
            {communitySearch && (
              <button
                type="button"
                onClick={() => setCommunitySearch('')}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Clear search filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {displayedCommunities.map((item) => {
              const maxCount = allCommunities[0]?.count || 1;
              const barPercent = Math.min(100, Math.max(8, Math.round((item.count / maxCount) * 100)));

              return (
                <div
                  key={item.name}
                  onClick={() => navigate(`/permits/historical?location=${encodeURIComponent(item.name)}`)}
                  className="p-3.5 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all bg-gradient-to-br from-white to-gray-50/60 hover:to-blue-50/20 cursor-pointer group flex flex-col justify-between"
                  title={`Click to view all ${item.count} permits in ${item.name}`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition block truncate uppercase">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {item.percent > 0 ? `${item.percent}% of district` : '<1% of district'}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-2xs group-hover:border-blue-200 group-hover:text-blue-700 transition">
                      {item.count}
                    </span>
                  </div>

                  <div className="space-y-1.5 mt-1">
                    <div className="w-full bg-gray-200/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 group-hover:bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${barPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-400 group-hover:text-blue-600 transition-colors">
                      <span>Inspect zone</span>
                      <span className="font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default Analytics;
