import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PermitQRBadge from '../components/PermitQRBadge';

const Dashboard = () => {
  const navigate = useNavigate();

  // --- JWT OFFICER / ADMIN CHECK ---
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const savedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
  let user = null;
  try {
    user = savedUser ? JSON.parse(savedUser) : null;
  } catch (e) {
    console.error("User parse error:", e);
  }

  // Any user with an active token is an authenticated officer
  const isUploader = Boolean(token);
  const isOfficer = isUploader;

  const [totalPermits, setTotalPermits] = useState(0);
  const [recentPermits, setRecentPermits] = useState([]);
  const [residentialCount, setResidentialCount] = useState(0);
  const [commercialCount, setCommercialCount] = useState(0);
  const [zonesCount, setZonesCount] = useState(0);
  const [quickSearch, setQuickSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals & Document Attachment States
  const [selectedPermit, setSelectedPermit] = useState(null);
  const [uploadingCategory, setUploadingCategory] = useState(null);
  const [viewerDoc, setViewerDoc] = useState({ isOpen: false, url: '', title: '' });
  const [qrModal, setQrModal] = useState({ isOpen: false, code: '', permitNum: '', applicantName: '' });

  const handleOpenDocViewer = (url, title) => {
    if (!url) return;
    setViewerDoc({ isOpen: true, url, title });
  };

  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      return url.replace(/\/view(\?.*)?$/, '/preview').replace(/\/edit(\?.*)?$/, '/preview');
    }
    return url;
  };

  const getGoogleMapsUrl = (address, location) => {
    if (!address) return '#';
    const cleanAddress = address.trim();
    const cleanLocation = location ? location.trim() : '';
    const fullSearchQuery = `${cleanAddress}, ${cleanLocation}, Ghana`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullSearchQuery)}`;
  };

  const handleShowQrBadge = async (permit) => {
    try {
      const res = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/qr/${encodeURIComponent(permit.permit_number)}`);
      const data = await res.json();
      if (data.success && data.qrCode) {
        setQrModal({
          isOpen: true,
          code: data.qrCode,
          permitNum: permit.permit_number,
          applicantName: permit.applicant_name || `${permit.first_name || ''} ${permit.last_name || ''}`.trim()
        });
      } else {
        alert("Could not generate QR Badge.");
      }
    } catch (err) {
      console.error("QR Code Fetch Error:", err);
      alert("Error generating QR Badge.");
    }
  };

  // OFFICER DOCUMENT DELETION HANDLERS
  const handleDeleteDocument = async (category, fileUrl, partLabel = '') => {
    if (!selectedPermit || !token) return;

    const categoryNames = {
      certificate: 'Certificate',
      drawings: 'Architectural Drawing',
      permitForm: 'Permit Form'
    };

    const docName = partLabel ? `${categoryNames[category] || 'Document'} (${partLabel})` : (categoryNames[category] || 'Document');

    if (!window.confirm(`Are you sure you want to permanently delete this ${docName}?`)) {
      return;
    }

    const columnMap = {
      certificate: 'certificate_link',
      drawings: 'drawings_links',
      permitForm: 'permit_form_link'
    };

    const columnName = columnMap[category];
    if (!columnName) return;

    try {
      const res = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/${selectedPermit.id}/remove-file`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          column_name: columnName,
          file_url: fileUrl
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove document.');
      }

      const updatedValue = data.new_links || null;

      setSelectedPermit(prev => ({
        ...prev,
        [columnName]: updatedValue
      }));

      setRecentPermits(prev => prev.map(p => String(p.id) === String(selectedPermit.id) ? { ...p, [columnName]: updatedValue } : p));
      alert(`${docName} deleted successfully.`);

      fetchDashboardData();
    } catch (err) {
      console.error("Delete document error:", err);
      alert("Failed to delete document: " + err.message);
    }
  };

  const handleDeleteAllDocuments = async (category, label) => {
    if (!selectedPermit || !token) return;

    if (!window.confirm(`Are you sure you want to permanently delete ALL ${label}s for this permit?`)) {
      return;
    }

    const columnMap = {
      certificate: 'certificate_link',
      drawings: 'drawings_links',
      permitForm: 'permit_form_link'
    };

    const columnName = columnMap[category];
    if (!columnName) return;

    try {
      const res = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/${selectedPermit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          [columnName]: null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove documents.');
      }

      setSelectedPermit(prev => ({
        ...prev,
        [columnName]: null
      }));

      setRecentPermits(prev => prev.map(p => String(p.id) === String(selectedPermit.id) ? { ...p, [columnName]: null } : p));
      alert(`All ${label}s deleted successfully.`);

      fetchDashboardData();
    } catch (err) {
      console.error("Delete all error:", err);
      alert("Failed to delete documents: " + err.message);
    }
  };

  const renderLinks = (linkString, label, category = '') => {
    if (!linkString || linkString === 'null' || linkString === 'undefined') return null;
    const links = linkString
      .split(',')
      .map(link => link.trim())
      .filter(l => l && l !== 'null' && l !== 'undefined');
    if (links.length === 0) return null;

    if (links.length === 1) {
      return (
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <a
            href={links[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs hover:shadow-xs transition"
          >
            <span>📄 Open {label}</span>
            <span className="text-xs">↗</span>
          </a>
          <button
            type="button"
            onClick={() => handleOpenDocViewer(links[0], `${label} - ${selectedPermit?.permit_number}`)}
            className="text-xs font-medium px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition cursor-pointer"
          >
            Preview
          </button>
          {isOfficer && category && (
            <button
              type="button"
              onClick={() => handleDeleteDocument(category, links[0])}
              className="text-xs font-semibold px-2.5 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg transition cursor-pointer border border-red-200 flex items-center gap-1"
              title={`Delete ${label}`}
            >
              <span>🗑️ Delete</span>
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="mb-1 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase">{label}S ({links.length}):</span>
          {isOfficer && category && (
            <button
              type="button"
              onClick={() => handleDeleteAllDocuments(category, label)}
              className="text-[11px] font-semibold text-red-600 hover:text-red-800 hover:underline cursor-pointer flex items-center gap-1"
              title={`Delete all ${label}s`}
            >
              <span>🗑️ Delete All</span>
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((link, index) => (
            <div key={index} className="inline-flex items-center rounded-lg border border-blue-200 overflow-hidden text-xs">
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-2.5 py-1 transition flex items-center gap-1"
              >
                <span>Part {index + 1}</span>
                <span className="text-[10px]">↗</span>
              </a>
              <button
                type="button"
                onClick={() => handleOpenDocViewer(link, `${label} Part ${index + 1} - ${selectedPermit?.permit_number}`)}
                className="bg-white hover:bg-gray-50 text-gray-500 px-2 py-1 border-l border-blue-200 cursor-pointer text-[11px]"
                title="Quick preview"
              >
                👁️
              </button>
              {isOfficer && category && (
                <button
                  type="button"
                  onClick={() => handleDeleteDocument(category, link, `Part ${index + 1}`)}
                  className="bg-white hover:bg-red-50 text-red-500 hover:text-red-700 px-2 py-1 border-l border-blue-200 cursor-pointer text-[11px] transition"
                  title={`Delete Part ${index + 1}`}
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // DIRECT DOCUMENT UPLOAD & ATTACHMENT
  const handleViewUpload = async (category, fileList) => {
    if (!fileList || fileList.length === 0 || !selectedPermit) return;

    setUploadingCategory(category);

    try {
      const activeCategories = [category];
      const applicantName = selectedPermit.applicant_name ||
        `${selectedPermit.first_name || ''} ${selectedPermit.last_name || ''}`.trim() ||
        'Applicant';

      // 1. Create or fetch target subfolder on Google Drive
      const folderRes = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/create-permit-folders", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          permitNumber: selectedPermit.permit_number,
          applicantName: applicantName,
          categories: activeCategories
        })
      });

      const folderData = await folderRes.json();
      if (!folderRes.ok || !folderData.success) {
        throw new Error(folderData.message || "Could not access destination folder on Google Drive.");
      }

      const targetFolderId = folderData.subfolders?.[category];
      if (!targetFolderId) {
        throw new Error("Could not access destination folder on Google Drive.");
      }

      // 2. Resumable Google Drive upload helper
      const uploadDirectToDrive = async (file) => {
        const sessionRes = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/get-drive-upload-url", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            targetFolderId: targetFolderId,
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            fileSize: file.size
          })
        });

        const sessionData = await sessionRes.json();
        if (!sessionData.success || !sessionData.uploadUrl) {
          throw new Error("Google Drive upload rejected.");
        }

        const driveRes = await fetch(sessionData.uploadUrl, {
          method: "PUT",
          headers: {
            'Content-Range': `bytes 0-${file.size - 1}/${file.size}`
          },
          body: file
        });
        if (driveRes.ok) {
          const resJson = await driveRes.json();
          return `https://drive.google.com/file/d/${resJson.id}/view`;
        }
        throw new Error("Document upload failed.");
      };

      // 3. Upload all selected files concurrently
      const uploadedLinks = await Promise.all(Array.from(fileList).map(f => uploadDirectToDrive(f)));

      // 4. Merge links with existing records
      let updateKey = '';
      let updatedValue = '';

      if (category === 'certificate') {
        updateKey = 'certificate_link';
        updatedValue = uploadedLinks[0] || '';
      } else if (category === 'drawings') {
        updateKey = 'drawings_links';
        const existing = (selectedPermit.drawings_links && selectedPermit.drawings_links !== 'null')
          ? selectedPermit.drawings_links.split(',').map(s => s.trim()).filter(s => s && s !== 'null')
          : [];
        updatedValue = [...existing, ...uploadedLinks].join(', ');
      } else if (category === 'permitForm') {
        updateKey = 'permit_form_link';
        const existing = (selectedPermit.permit_form_link && selectedPermit.permit_form_link !== 'null')
          ? selectedPermit.permit_form_link.split(',').map(s => s.trim()).filter(s => s && s !== 'null')
          : [];
        updatedValue = [...existing, ...uploadedLinks].join(', ');
      }

      // 5. Update Supabase record
      const updateRes = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/${selectedPermit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          [updateKey]: updatedValue,
          upload_status: 'completed'
        })
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok || !updateData.success) {
        throw new Error(updateData.message || "Failed to record document link in database.");
      }

      // 6. Update local state
      setSelectedPermit(prev => ({ ...prev, [updateKey]: updatedValue }));
      setRecentPermits(prev => prev.map(p => String(p.id) === String(selectedPermit.id) ? { ...p, [updateKey]: updatedValue } : p));
      alert("Document attached and archived successfully!");

      fetchDashboardData();

    } catch (err) {
      console.error("View Upload Error:", err);
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingCategory(null);
    }
  };

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

  useEffect(() => {
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
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Building Permit Records Management System
          </h1>
        </div>

        {/* Quick Search Bar */}
        <form onSubmit={handleQuickSearch} className="relative w-full lg:w-96">
          <input
            type="text"
            placeholder="Quick search permits..."
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
          to="/permits/historical"
          className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
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
          to="/permits/historical?purpose=RESIDENTIAL"
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
          to="/permits/historical?purpose=COMMERCIAL"
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
        <div className={`grid grid-cols-1 ${isUploader ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-5`}>
          {isUploader && (
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
          )}

          {/* SEARCH RECORDS ACTION */}
          <Link
            to="/permits/historical"
            className="group flex items-center p-6 bg-white border border-gray-200 rounded-xl shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl mr-4 group-hover:bg-blue-100 transition-colors text-2xl">
              🔍
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Search Records</h3>
            </div>
          </Link>
        </div>
      </div>

      {/* RECENT RECORDS SECTION */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Records</h2>
          </div>
          <Link
            to="/permits/historical"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            <span>View Full Records</span>
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
                        <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${isResidential
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
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${isArchived
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isArchived ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          {isArchived ? 'Archived' : 'In Review'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedPermit(permit)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap cursor-pointer"
                        >
                          <span>👁️</span>
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DOCUMENT & DETAILS VIEW MODAL */}
      {selectedPermit && (() => {
        const modalName = selectedPermit.applicant_name || `${selectedPermit.first_name || ''} ${selectedPermit.last_name || ''}`.trim();
        const modalPurpose = selectedPermit.purpose || 'RESIDENTIAL';

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Archived Documents & Details</h3>
                  <p className="text-sm text-gray-500 mt-1">Permit Number: <span className="font-semibold text-blue-900">{selectedPermit.permit_number}</span></p>
                </div>
                <button onClick={() => setSelectedPermit(null)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto bg-gray-50 space-y-6">
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block font-semibold text-gray-400 text-xs">PURPOSE / USE</span>
                    <p className="text-gray-800 font-bold uppercase">{modalPurpose}</p>
                  </div>
                  <div>
                    <span className="block font-semibold text-gray-400 text-xs">APPLICANT / ORGANIZATION</span>
                    <p className="text-gray-800 font-bold uppercase">{modalName}</p>
                  </div>
                  <div>
                    <span className="block font-semibold text-gray-400 text-xs">LOCATION / COMMUNITY</span>
                    <p className="text-gray-800 font-semibold uppercase">{selectedPermit.location || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="block font-semibold text-gray-400 text-xs">SITE ADDRESS & MAP PIN</span>
                    {selectedPermit.address ? (
                      <a
                        href={getGoogleMapsUrl(selectedPermit.address, selectedPermit.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-bold uppercase hover:underline inline-flex items-center space-x-1"
                      >
                        <span>📍 {selectedPermit.address}</span>
                        <span className="text-xs font-normal">↗</span>
                      </a>
                    ) : (
                      <p className="text-gray-400 italic">N/A</p>
                    )}
                  </div>
                </div>

                {/* 3 DOCUMENT CARDS WITH INLINE ATTACHMENT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* CARD 1: CERTIFICATE */}
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800 mb-2 border-b pb-2 flex items-center justify-between">
                        <span>📜 Certificate</span>
                        {selectedPermit.certificate_link && selectedPermit.certificate_link !== 'null' && (
                          <span className="text-xs text-green-600 font-semibold">✓ Archived</span>
                        )}
                      </h4>
                      <div className="min-h-[48px]">
                        {renderLinks(selectedPermit.certificate_link, "Certificate", "certificate") || (
                          <span className="text-xs text-gray-400 italic">No certificate uploaded yet</span>
                        )}
                      </div>
                    </div>

                    {isOfficer && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <label className={`w-full py-2 px-3 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition cursor-pointer border ${uploadingCategory === 'certificate' ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}`}>
                          <span>{uploadingCategory === 'certificate' ? '⏳ Uploading...' : (selectedPermit.certificate_link && selectedPermit.certificate_link !== 'null' ? '🔄 Replace Certificate' : '📁 Attach Certificate')}</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            disabled={uploadingCategory !== null}
                            onChange={(e) => {
                              handleViewUpload('certificate', e.target.files);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* CARD 2: DRAWINGS */}
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800 mb-2 border-b pb-2 flex items-center justify-between">
                        <span>📐 Architectural Drawings</span>
                        {selectedPermit.drawings_links && selectedPermit.drawings_links !== 'null' && (
                          <span className="text-xs text-green-600 font-semibold">✓ Archived</span>
                        )}
                      </h4>
                      <div className="min-h-[48px]">
                        {renderLinks(selectedPermit.drawings_links, "Drawing", "drawings") || (
                          <span className="text-xs text-gray-400 italic">No drawings uploaded yet</span>
                        )}
                      </div>
                    </div>

                    {isOfficer && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <label className={`w-full py-2 px-3 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition cursor-pointer border ${uploadingCategory === 'drawings' ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}`}>
                          <span>{uploadingCategory === 'drawings' ? '⏳ Uploading Drawings...' : '+ Add Architectural Drawings'}</span>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,image/*"
                            disabled={uploadingCategory !== null}
                            onChange={(e) => {
                              handleViewUpload('drawings', e.target.files);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* CARD 3: PERMIT FORM */}
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800 mb-2 border-b pb-2 flex items-center justify-between">
                        <span>📑 Permit Form</span>
                        {selectedPermit.permit_form_link && selectedPermit.permit_form_link !== 'null' && (
                          <span className="text-xs text-green-600 font-semibold">✓ Archived</span>
                        )}
                      </h4>
                      <div className="min-h-[48px]">
                        {renderLinks(selectedPermit.permit_form_link, "Form", "permitForm") || (
                          <span className="text-xs text-gray-400 italic">No permit form uploaded yet</span>
                        )}
                      </div>
                    </div>

                    {isOfficer && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <label className={`w-full py-2 px-3 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition cursor-pointer border ${uploadingCategory === 'permitForm' ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}`}>
                          <span>{uploadingCategory === 'permitForm' ? '⏳ Uploading Form...' : '+ Attach Permit Form'}</span>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,image/*"
                            disabled={uploadingCategory !== null}
                            onChange={(e) => {
                              handleViewUpload('permitForm', e.target.files);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleShowQrBadge(selectedPermit)}
                    className="bg-purple-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-purple-700 transition text-xs flex items-center space-x-1.5 shadow"
                  >
                    <span>🖨️ Print Verification Badge Sticker</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DOCUMENT PREVIEW MODAL */}
      {viewerDoc.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-gray-200">
            <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center">
              <span className="font-bold text-sm tracking-wide truncate max-w-lg">{viewerDoc.title}</span>
              <div className="flex items-center space-x-3">
                <a
                  href={viewerDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition"
                >
                  Open in New Tab ↗
                </a>
                <button
                  onClick={() => setViewerDoc({ isOpen: false, url: '', title: '' })}
                  className="text-gray-400 hover:text-white p-1 rounded transition text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 flex items-center justify-center relative">
              <iframe
                src={getEmbedUrl(viewerDoc.url)}
                title={viewerDoc.title}
                className="w-full h-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}

      {/* QR BADGE MODAL */}
      {qrModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative max-w-sm w-full">
            <button
              onClick={() => setQrModal({ isOpen: false, code: '', permitNum: '', applicantName: '' })}
              className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold hover:bg-red-700 shadow-md z-10"
            >
              ✕
            </button>
            <PermitQRBadge
              permitNumber={qrModal.permitNum}
              dateIssued={selectedPermit?.date_issued}
              qrCodeBase64={qrModal.code}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;