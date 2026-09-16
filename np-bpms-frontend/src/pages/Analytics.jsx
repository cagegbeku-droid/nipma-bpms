import React, { useState, useEffect, useMemo } from 'react';
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

const PURPOSE_COLORS = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1'];

const Analytics = () => {
  const navigate = useNavigate();

  const [permits, setPermits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('ALL'); // 'ALL', '12M', '6M'

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await fetch("https://nipma-bpms-backend.onrender.com/api/permits");
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setPermits(data.data);
        } else {
          setError("Failed to load records.");
        }
      } catch (err) {
        setError("Unable to connect to records registry.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
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
    const total = filteredRecords.length;
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
      residential,
      commercial: commercial || (total - residential),
      zonesCount: uniqueLocations || 1,
      resPercent,
      commPercent,
      avgMonthly
    };
  }, [filteredRecords]);

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

  // Top Communities Ranking
  const topCommunities = useMemo(() => {
    const locMap = {};
    filteredRecords.forEach(p => {
      const loc = (p.location || '').trim().toUpperCase();
      if (loc && loc !== 'N/A') {
        locMap[loc] = (locMap[loc] || 0) + 1;
      }
    });

    return Object.keys(locMap)
      .map(name => ({ name, count: locMap[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredRecords]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Analytics
          </h1>
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
            All Time
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
            <h3 className="text-base font-bold text-gray-900">Registration Trends</h3>
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

      {/* Row 2: Communities Section */}
      <div id="communities-section" className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Communities & Zones</h3>
          </div>
          <Link
            to="/permits/historical"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            View in Registry →
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <div key={n} className="animate-pulse h-16 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        ) : topCommunities.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500">
            No community data recorded
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {topCommunities.map((item, idx) => {
              const maxCount = topCommunities[0]?.count || 1;
              const barPercent = Math.round((item.count / maxCount) * 100);

              return (
                <div
                  key={item.name}
                  onClick={() => navigate(`/permits/historical?location=${encodeURIComponent(item.name)}`)}
                  className="p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-xs transition bg-gray-50/50 hover:bg-white cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition truncate pr-2 uppercase">
                      {item.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-2xs">
                      {item.count}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${barPercent}%` }}
                    />
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
