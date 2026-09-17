import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PermitQRBadge from '../components/PermitQRBadge';

const PermitList = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const savedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
  let user = null;
  try {
    user = savedUser ? JSON.parse(savedUser) : null;
  } catch (e) {
    console.error("Failed to parse user session", e);
  }
  
  // Any user with an active token is an authenticated officer
  const isOfficer = Boolean(token);

  const [permits, setPermits] = useState([]);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedPurpose, setSelectedPurpose] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [sortBy, setSortBy] = useState('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [confirmDeleteModal, setConfirmDeleteModal] = useState({ isOpen: false, permitId: null, permitNumber: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3500);
  };

  const [selectedPermit, setSelectedPermit] = useState(null); 
  const [editingPermit, setEditingPermit] = useState(null);   
  const [editFormData, setEditFormData] = useState({});       
  const [isSaving, setIsSaving] = useState(false);            
  const [uploadingCategory, setUploadingCategory] = useState(null);

  const [viewerDoc, setViewerDoc] = useState({ isOpen: false, url: '', title: '' });
  const [qrModal, setQrModal] = useState({ isOpen: false, code: '', permitNum: '', applicantName: '' });

  // Sync with search parameter if changed from outside
  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
    }
    const p = searchParams.get('purpose');
    if (p !== null) {
      setSelectedPurpose(p.toUpperCase());
    }
    const loc = searchParams.get('location');
    if (loc !== null) {
      setSelectedLocation(loc.toUpperCase());
    }
  }, [searchParams]);

  // Auto-open modal if ?view=PERMIT_NUMBER or ID is passed
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam && permits.length > 0) {
      const match = permits.find(p => p.permit_number === viewParam || String(p.id) === viewParam);
      if (match) {
        setSelectedPermit(match);
      }
    }
  }, [searchParams, permits]);

  // Reset to page 1 whenever any filter or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth, selectedYear, selectedPurpose, selectedLocation, sortBy, pageSize]);

  useEffect(() => {
    fetchPermits();
  }, []);

  const fetchPermits = async () => {
    try {
      const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits");
      const data = await response.json();
      if (data.success) {
        setPermits(data.data);
      } else {
        setError("Failed to load records. Please try again.");
      }
    } catch (err) {
      setError("Unable to connect to records registry. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const triggerDelete = (permit) => {
    setConfirmDeleteModal({
      isOpen: true,
      permitId: permit.id,
      permitNumber: permit.permit_number
    });
  };

  const confirmDeleteAction = async () => {
    const id = confirmDeleteModal.permitId;
    setConfirmDeleteModal({ isOpen: false, permitId: null, permitNumber: '' });
    if (!id) return;

    try {
      const response = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/${id}`, {
        method: "DELETE",
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setPermits(prev => prev.filter(permit => permit.id !== id));
        showToast("Permit record deleted successfully.", "success");
      } else {
        showToast(data.message || "Failed to delete record. Permission denied.", "error");
      }
    } catch (err) {
      showToast("Connection error. Please try again.", "error");
    }
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
        showToast("Could not generate QR Badge.", "error");
      }
    } catch (err) {
      console.error("QR Code Fetch Error:", err);
      showToast("Error generating QR Badge.", "error");
    }
  };

  const getGoogleMapsUrl = (address, location) => {
    if (!address) return '#';
    const cleanAddress = address.trim();
    const cleanLocation = location ? location.trim() : '';
    const fullSearchQuery = `${cleanAddress}, ${cleanLocation}, Ghana`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullSearchQuery)}`;
  };

  const formatPermitNumberInput = (value) => {
    const cleanVal = (value || '').trim().toUpperCase();
    const shorthandMatch = cleanVal.match(/^([A-Z]{3,4})(\d{2})(\d{1,4})$/);
    if (shorthandMatch) {
      const [, location, year, serial] = shorthandMatch;
      return `NIPDA/${location}/${year}/${serial}`;
    }
    return cleanVal;
  };

  const availableYears = useMemo(() => {
    const years = new Set();
    permits.forEach(p => {
      if (p.date_issued) {
        const cleanDateStr = p.date_issued.split('T')[0];
        const year = cleanDateStr.split('-')[0];
        if (year && !isNaN(year)) {
          years.add(year);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [permits]);

  const availableLocations = useMemo(() => {
    const locs = new Set();
    permits.forEach(p => {
      if (p.location && p.location.trim() && p.location.trim().toUpperCase() !== 'N/A') {
        locs.add(p.location.trim().toUpperCase());
      }
    });
    return Array.from(locs).sort();
  }, [permits]);

  const availablePurposes = useMemo(() => {
    const purps = new Set(['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'CIVIC', 'MIXED-USE']);
    permits.forEach(p => {
      if (p.purpose && p.purpose.trim()) {
        purps.add(p.purpose.trim().toUpperCase());
      }
    });
    return Array.from(purps).sort();
  }, [permits]);

  const filteredPermits = useMemo(() => {
    return permits.filter(permit => {
      const search = searchTerm.toLowerCase().trim();
      const applicantName = permit.applicant_name || `${permit.first_name || ''} ${permit.last_name || ''}`;

      let permitMonth = '';
      let permitYear = '';
      if (permit.date_issued) {
        const cleanDateStr = permit.date_issued.split('T')[0];
        const parts = cleanDateStr.split('-');
        if (parts.length >= 2) {
          permitYear = parts[0];
          permitMonth = parts[1];
        }
      }

      const matchesMonth = selectedMonth === 'ALL' || permitMonth === selectedMonth;
      const matchesYear = selectedYear === 'ALL' || permitYear === selectedYear;

      const pPurpose = (permit.purpose || 'RESIDENTIAL').toUpperCase();
      const matchesPurpose = selectedPurpose === 'ALL' || 
        pPurpose.includes(selectedPurpose) ||
        (selectedPurpose === 'COMMERCIAL' && (
          pPurpose.includes('COMMERCIAL') ||
          pPurpose.includes('CIVIC') ||
          pPurpose.includes('INSTITUT') ||
          pPurpose.includes('ORGANIZ') ||
          pPurpose.includes('INDUSTRIAL')
        ));

      const pLocation = (permit.location || '').toUpperCase();
      const matchesLocation = selectedLocation === 'ALL' || pLocation === selectedLocation;

      const matchesSearch = !search || (
        permit.permit_number?.toLowerCase().includes(search) ||
        applicantName.toLowerCase().includes(search) ||
        permit.purpose?.toLowerCase().includes(search) ||
        permit.location?.toLowerCase().includes(search) ||
        permit.address?.toLowerCase().includes(search) ||
        permit.phone?.includes(search)
      );

      return matchesMonth && matchesYear && matchesPurpose && matchesLocation && matchesSearch;
    });
  }, [permits, searchTerm, selectedMonth, selectedYear, selectedPurpose, selectedLocation]);

  const sortedPermits = useMemo(() => {
    const list = [...filteredPermits];
    if (sortBy === 'date-desc') {
      return list.sort((a, b) => (b.date_issued || '').localeCompare(a.date_issued || ''));
    }
    if (sortBy === 'date-asc') {
      return list.sort((a, b) => (a.date_issued || '').localeCompare(b.date_issued || ''));
    }
    if (sortBy === 'permit-asc') {
      return list.sort((a, b) => (a.permit_number || '').localeCompare(b.permit_number || ''));
    }
    if (sortBy === 'permit-desc') {
      return list.sort((a, b) => (b.permit_number || '').localeCompare(a.permit_number || ''));
    }
    if (sortBy === 'name-asc') {
      const nameA = a.applicant_name || `${a.first_name || ''} ${a.last_name || ''}`;
      const nameB = b.applicant_name || `${b.first_name || ''} ${b.last_name || ''}`;
      return nameA.localeCompare(nameB);
    }
    return list;
  }, [filteredPermits, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedPermits.length / pageSize));
  const paginatedPermits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedPermits.slice(start, start + pageSize);
  }, [sortedPermits, currentPage, pageSize]);

  const exportToCSV = () => {
    if (sortedPermits.length === 0) {
      showToast("No records to export.", "info");
      return;
    }

    const headers = ["Permit Number", "Applicant Name", "Date Issued", "Purpose", "Location", "Phone", "Address"];
    const rows = sortedPermits.map(p => {
      const applicantName = p.applicant_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
      return [
        `"${p.permit_number || ''}"`,
        `"${applicantName}"`,
        `"${p.date_issued || ''}"`,
        `"${p.purpose || 'RESIDENTIAL'}"`,
        `"${p.location || ''}"`,
        `"${p.phone || ''}"`,
        `"${p.address || ''}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Building_Permit_Registry_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${sortedPermits.length} records to CSV`, "success");
  };

  const handlePrintReport = () => {
    if (sortedPermits.length === 0) {
      showToast("No records available to print.", "info");
      return;
    }
    window.print();
  };

  // EDIT MODAL: PURE METADATA (NO FILES)
  const handleEditClick = (permit) => {
    const standardPurposes = ['RESIDENTIAL', 'COMMERCIAL', 'INSTITUTION', 'ORGANIZATION', 'MIXED USE', 'FENCE WALL'];
    const currentPurpose = permit.purpose ? permit.purpose.toUpperCase() : 'RESIDENTIAL';
    const isStandard = standardPurposes.includes(currentPurpose);

    const applicantNameVal = permit.applicant_name || `${permit.first_name || ''} ${permit.last_name || ''}`.trim();

    setEditFormData({
      permit_number: permit.permit_number || '',
      date_issued: permit.date_issued ? permit.date_issued.split('T')[0] : '',
      purpose: isStandard ? currentPurpose : 'OTHER',
      custom_purpose: isStandard ? '' : currentPurpose,
      applicant_name: applicantNameVal.toUpperCase(),
      phone: permit.phone || '',
      address: permit.address || '',
      location: permit.location || ''
    });
    setEditingPermit(permit);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ 
      ...prev, 
      [name]: name === 'date_issued' || name === 'phone' ? value : value.toUpperCase() 
    }));
  };

  const handlePermitNumberBlur = () => {
    const formatted = formatPermitNumberInput(editFormData.permit_number);
    setEditFormData(prev => ({ ...prev, permit_number: formatted }));
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const finalPurpose = editFormData.purpose === 'OTHER' ? editFormData.custom_purpose : editFormData.purpose;
    const formattedPermitNum = formatPermitNumberInput(editFormData.permit_number);

    const payload = {
      permit_number: formattedPermitNum,
      date_issued: editFormData.date_issued,
      purpose: finalPurpose,
      applicant_name: editFormData.applicant_name,
      phone: editFormData.phone,
      address: editFormData.address,
      location: editFormData.location
    };

    try {
      const response = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/${editingPermit.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        alert(data.message || "Failed to update record.");
        return;
      }

      setPermits(prev => prev.map(p => p.id === editingPermit.id ? { ...p, ...payload } : p));
      setEditingPermit(null);
    } catch (err) {
      console.error("Edit Error:", err);
      alert("Server connection error during update.");
    } finally {
      setIsSaving(false);
    }
  };

  // VIEW MODAL: DIRECT DOCUMENT UPLOAD & ATTACHMENT
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

        const driveRes = await fetch(sessionData.uploadUrl, { method: "PUT", body: file });
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
        updatedValue = uploadedLinks[0];
      } else if (category === 'drawings') {
        updateKey = 'drawings_links';
        const existing = selectedPermit.drawings_links 
          ? selectedPermit.drawings_links.split(',').map(s => s.trim()).filter(Boolean) 
          : [];
        updatedValue = [...existing, ...uploadedLinks].join(', ');
      } else if (category === 'permitForm') {
        updateKey = 'permit_form_link';
        const existing = selectedPermit.permit_form_link 
          ? selectedPermit.permit_form_link.split(',').map(s => s.trim()).filter(Boolean) 
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
      setPermits(prev => prev.map(p => p.id === selectedPermit.id ? { ...p, [updateKey]: updatedValue } : p));
      showToast("Document attached and archived successfully!", "success");

    } catch (err) {
      console.error("View Upload Error:", err);
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingCategory(null);
    }
  };

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

  const renderLinks = (linkString, label) => {
    if (!linkString) return null;
    const links = linkString.split(',').map(link => link.trim()).filter(Boolean);
    if (links.length === 0) return null;

    if (links.length === 1) {
      return (
        <button 
          onClick={() => handleOpenDocViewer(links[0], `${label} - ${selectedPermit?.permit_number}`)}
          className="block text-blue-600 hover:text-blue-800 text-sm mb-1 hover:underline font-medium text-left cursor-pointer truncate max-w-full"
        >
          📄 View {label}
        </button>
      );
    }
    return (
      <div className="mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase">{label}S ({links.length}):</span>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {links.map((link, index) => (
            <button 
              key={index} 
              onClick={() => handleOpenDocViewer(link, `${label} Part ${index + 1} - ${selectedPermit?.permit_number}`)}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded text-xs hover:underline border border-blue-100 font-medium cursor-pointer"
            >
              Part {index + 1}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* PRINT-ONLY OFFICIAL STYLES & HEADER */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print, header, aside, nav, .filter-bar, .pagination-controls, .action-buttons {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-table {
            width: 100% !important;
            font-size: 11px !important;
            border-collapse: collapse !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 8px !important;
          }
          .print-table th {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>

      {/* PRINT-ONLY OFFICIAL HEADER */}
      <div className="print-only mb-6">
        <div className="text-center border-b-2 border-gray-900 pb-4">
          <h1 className="text-xl font-black uppercase tracking-wider text-gray-900">
            NINGO-PRAMPRAM MUNICIPAL ASSEMBLY
          </h1>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mt-1">
            WORKS & PHYSICAL PLANNING DEPARTMENT
          </h2>
          <p className="text-xs text-gray-600 mt-1 font-semibold">Official Building Permit Registry Report</p>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-600 mt-3 pb-2 border-b border-gray-200">
          <span>Date Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span>Total Records in Report: {sortedPermits.length}</span>
          <span>Category: {selectedPurpose} | Zone: {selectedLocation} | Year: {selectedYear}</span>
        </div>
      </div>

      {/* REGISTRY HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Building Permit Records Registry
          </h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={handlePrintReport}
            className="bg-gray-800 hover:bg-gray-900 text-white px-3.5 py-2 rounded-lg transition text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Print Official Committee Report"
          >
            <span>🖨️ Print Report</span>
          </button>

          <button 
            onClick={exportToCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg transition text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Export filtered records to CSV"
          >
            <span>📊 Export CSV</span>
          </button>

          {isOfficer && (
            <Link 
              to="/permits/new" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg transition text-xs font-semibold whitespace-nowrap shadow-xs"
            >
              + Add New Permit
            </Link>
          )}
        </div>
      </div>

      {/* ADVANCED MULTI-FILTER BAR */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4 no-print filter-bar">
        {/* Row 1: Search + Category + Community */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Search Keywords</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search permit #, applicant name, location, address..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50/70 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition"
              />
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Category / Purpose</label>
            <select 
              value={selectedPurpose} 
              onChange={(e) => setSelectedPurpose(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50/70 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none capitalize"
            >
              <option value="ALL">All Categories</option>
              {availablePurposes.map(purp => (
                <option key={purp} value={purp}>{purp}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Community / Zone</label>
            <select 
              value={selectedLocation} 
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50/70 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase"
            >
              <option value="ALL">All Communities</option>
              {availableLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Month + Year + Sort By + Reset */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Month</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Months</option>
              <option value="01">Jan</option>
              <option value="02">Feb</option>
              <option value="03">Mar</option>
              <option value="04">Apr</option>
              <option value="05">May</option>
              <option value="06">Jun</option>
              <option value="07">Jul</option>
              <option value="08">Aug</option>
              <option value="09">Sep</option>
              <option value="10">Oct</option>
              <option value="11">Nov</option>
              <option value="12">Dec</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Year</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sort By</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="date-desc">Date Issued (Newest)</option>
              <option value="date-asc">Date Issued (Oldest)</option>
              <option value="permit-asc">Permit # (A - Z)</option>
              <option value="permit-desc">Permit # (Z - A)</option>
              <option value="name-asc">Applicant (A - Z)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Per Page</label>
            <select 
              value={pageSize} 
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-full p-2 border border-gray-200 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value={10}>10 records</option>
              <option value={25}>25 records</option>
              <option value={50}>50 records</option>
              <option value={100}>100 records</option>
            </select>
          </div>

          <div className="flex items-end col-span-2 sm:col-span-1">
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedMonth('ALL');
                setSelectedYear('ALL');
                setSelectedPurpose('ALL');
                setSelectedLocation('ALL');
                setSortBy('date-desc');
              }}
              className="w-full p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition cursor-pointer text-center"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* Results Counter */}
        <div className="text-xs text-gray-500 font-medium pt-1">
          Found <span className="font-bold text-gray-900">{sortedPermits.length}</span> matching records 
          {(searchTerm || selectedPurpose !== 'ALL' || selectedLocation !== 'ALL' || selectedMonth !== 'ALL' || selectedYear !== 'ALL') && ' (filters active)'}
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-xl text-sm font-medium">{error}</div>}

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse print-table">
            <thead>
              <tr className="bg-gray-50/80 text-gray-700 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                <th className="p-4">Permit Info</th>
                <th className="p-4">Applicant / Entity</th>
                <th className="p-4">Property Details & GPS Map</th>
                <th className="p-4 text-center action-buttons">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {isLoading ? (
                <tr><td colSpan="4" className="p-12 text-center text-gray-400 animate-pulse">Loading secure records...</td></tr>
              ) : paginatedPermits.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-12 text-center">
                    <span className="text-3xl inline-block mb-2">📂</span>
                    <p className="text-sm font-medium text-gray-600">No records found matching your filters.</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting keywords or clearing category and zone filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedPermits.map((permit) => {
                  const displayName = permit.applicant_name || `${permit.first_name || ''} ${permit.last_name || ''}`.trim();
                  const displayPurpose = permit.purpose || 'RESIDENTIAL';
                  const isResidential = displayPurpose.toUpperCase().includes('RESIDENTIAL');

                  return (
                    <tr key={permit.id} className="hover:bg-blue-50/25 transition group">
                      <td className="p-4 align-middle">
                        <div className="font-bold text-gray-900 font-mono tracking-tight text-base">{permit.permit_number}</div>
                        <div className="mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                            isResidential 
                              ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {displayPurpose}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Issued: {permit.date_issued || 'N/A'}</div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="font-semibold text-gray-900 uppercase">{displayName}</div>
                        <div className="text-xs text-gray-500 mt-1">📞 {permit.phone || 'N/A'}</div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="text-xs font-semibold text-gray-800 uppercase">
                          <span className="text-gray-400 font-normal">Location:</span> {permit.location || 'N/A'}
                        </div>

                        <div className="text-xs uppercase mt-1">
                          <span className="text-gray-400 font-normal">Address:</span>{' '}
                          {permit.address ? (
                            <a 
                              href={getGoogleMapsUrl(permit.address, permit.location)}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-bold hover:underline"
                              title="Open site location on Google Maps"
                            >
                              <span>📍 {permit.address}</span>
                              <span className="text-xs font-normal">↗</span>
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-middle text-center action-buttons">
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            onClick={() => setSelectedPermit(permit)} 
                            className="bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs" 
                            title="View Documents"
                          >
                            👁️ View
                          </button>

                          <button 
                            onClick={() => handleShowQrBadge(permit)} 
                            className="bg-purple-50 hover:bg-purple-600 text-purple-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs" 
                            title="Print QR Badge"
                          >
                            🖨️ Badge
                          </button>
                          
                          {isOfficer && (
                            <>
                              <button 
                                onClick={() => handleEditClick(permit)} 
                                className="bg-gray-100 hover:bg-gray-800 text-gray-700 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs" 
                                title="Edit Permit Metadata"
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                onClick={() => triggerDelete(permit)} 
                                className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs" 
                                title="Delete Record"
                              >
                                🗑️ Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION CONTROLS */}
        {sortedPermits.length > 0 && (
          <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 no-print pagination-controls">
            <div className="text-xs text-gray-500 font-medium">
              Showing <span className="font-bold text-gray-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-gray-900">{Math.min(currentPage * pageSize, sortedPermits.length)}</span> of{' '}
              <span className="font-bold text-gray-900">{sortedPermits.length}</span> permits
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ← Previous
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((pageNum, idx, arr) => {
                    const showEllipsis = idx > 0 && pageNum - arr[idx - 1] > 1;
                    return (
                      <React.Fragment key={pageNum}>
                        {showEllipsis && <span className="text-xs text-gray-400 px-1">...</span>}
                        <button
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PRINT-ONLY SIGN-OFF BLOCK */}
      <div className="print-only mt-12 pt-6 border-t border-gray-400">
        <div className="grid grid-cols-2 gap-12 text-xs text-gray-700">
          <div>
            <p className="font-bold">Prepared By:</p>
            <div className="mt-8 border-b border-gray-500 w-48"></div>
            <p className="mt-1">Records & Archive Officer</p>
          </div>
          <div>
            <p className="font-bold">Certified / Approved By:</p>
            <div className="mt-8 border-b border-gray-500 w-48"></div>
            <p className="mt-1">Municipal Planning / Works Director</p>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDeleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-2xl mx-auto mb-4">
              🗑️
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center">Delete Permit Record</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              Are you sure you want to permanently delete record{' '}
              <span className="font-mono font-bold text-gray-800">{confirmDeleteModal.permitNumber}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmDeleteModal({ isOpen: false, permitId: null, permitNumber: '' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAction}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition cursor-pointer shadow-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP TOAST NOTIFICATION */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-gray-700 animate-bounce">
          <span>{toast.type === 'error' ? '❌' : toast.type === 'success' ? '✅' : 'ℹ️'}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* VIEW DOCUMENTS & ATTACH MODAL */}
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
                        {selectedPermit.certificate_link && <span className="text-xs text-green-600 font-semibold">✓ Archived</span>}
                      </h4>
                      <div className="min-h-[48px]">
                        {renderLinks(selectedPermit.certificate_link, "Certificate") || (
                          <span className="text-xs text-gray-400 italic">No certificate uploaded yet</span>
                        )}
                      </div>
                    </div>

                    {isOfficer && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <label className={`w-full py-2 px-3 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition cursor-pointer border ${uploadingCategory === 'certificate' ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}`}>
                          <span>{uploadingCategory === 'certificate' ? '⏳ Uploading...' : (selectedPermit.certificate_link ? '🔄 Replace Certificate' : '📁 Attach Certificate')}</span>
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
                        {selectedPermit.drawings_links && <span className="text-xs text-green-600 font-semibold">✓ Archived</span>}
                      </h4>
                      <div className="min-h-[48px]">
                        {renderLinks(selectedPermit.drawings_links, "Drawing") || (
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
                        {selectedPermit.permit_form_link && <span className="text-xs text-green-600 font-semibold">✓ Archived</span>}
                      </h4>
                      <div className="min-h-[48px]">
                        {renderLinks(selectedPermit.permit_form_link, "Form") || (
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
            <div className="flex justify-between items-center px-6 py-4 bg-gray-900 text-white border-b border-gray-800">
              <div className="flex items-center space-x-2 truncate">
                <span className="text-xl">📄</span>
                <h3 className="font-bold text-lg truncate text-gray-100">
                  {viewerDoc.title || 'Document Preview'}
                </h3>
              </div>
              
              <div className="flex items-center space-x-3">
                <a 
                  href={viewerDoc.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded border border-gray-700 transition"
                >
                  Open External ↗
                </a>
                <button 
                  onClick={() => setViewerDoc({ isOpen: false, url: '', title: '' })}
                  className="text-gray-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 transition cursor-pointer"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-100 relative">
              <iframe 
                src={getEmbedUrl(viewerDoc.url)} 
                className="w-full h-full border-0"
                title={viewerDoc.title || 'Document Preview'}
                allow="autoplay"
              />
            </div>
            
            <div className="bg-white px-6 py-2.5 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
              <span>Building Permit Records Management System</span>
              <button 
                onClick={() => setViewerDoc({ isOpen: false, url: '', title: '' })}
                className="px-4 py-1.5 bg-gray-200 text-gray-800 font-semibold rounded hover:bg-gray-300 transition cursor-pointer"
              >
                Close Viewer
              </button>
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
              className="absolute -top-3 -right-3 z-10 bg-white text-gray-700 hover:text-red-500 rounded-full w-8 h-8 font-bold text-lg flex items-center justify-center shadow-lg border border-gray-200 cursor-pointer print:hidden"
            >
              &times;
            </button>

            <PermitQRBadge 
              permitNumber={qrModal.permitNum}
              applicantName={qrModal.applicantName}
              qrCodeBase64={qrModal.code}
            />
          </div>
        </div>
      )}

      {/* EDIT METADATA MODAL (FAST - NO FILES) */}
      {editingPermit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Edit Permit Details</h3>
              <button onClick={() => setEditingPermit(null)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition cursor-pointer">
                ✕
              </button>
            </div>
            
            <form onSubmit={submitEdit} className="p-6 overflow-y-auto bg-white space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Permit Number</label>
                  <input 
                    type="text" 
                    name="permit_number" 
                    value={editFormData.permit_number} 
                    onChange={handleEditChange} 
                    onBlur={handlePermitNumberBlur}
                    required 
                    className="w-full p-2 border border-gray-300 rounded-md uppercase text-sm" 
                    placeholder="E.G., NIPDA/PRAM/25/17"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Issued</label>
                  <input type="date" name="date_issued" value={editFormData.date_issued} onChange={handleEditChange} required className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Building Purpose / Use</label>
                  <select name="purpose" value={editFormData.purpose} onChange={handleEditChange} required className="w-full p-2 border border-gray-300 rounded-md bg-white uppercase text-sm">
                    <option value="RESIDENTIAL">RESIDENTIAL</option>
                    <option value="COMMERCIAL">COMMERCIAL</option>
                    <option value="INSTITUTION">INSTITUTION</option>
                    <option value="ORGANIZATION">ORGANIZATION</option>
                    <option value="MIXED USE">MIXED USE</option>
                    <option value="FENCE WALL">FENCE WALL</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                {editFormData.purpose === 'OTHER' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Specify Other Purpose</label>
                    <input type="text" name="custom_purpose" value={editFormData.custom_purpose} onChange={handleEditChange} required className="w-full p-2 border border-gray-300 rounded-md uppercase text-sm" placeholder="E.G., INDUSTRIAL WAREHOUSE" />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Applicant / Organization Name</label>
                  <input type="text" name="applicant_name" value={editFormData.applicant_name} onChange={handleEditChange} required className="w-full p-2 border border-gray-300 rounded-md uppercase text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" name="phone" value={editFormData.phone} onChange={handleEditChange} className="w-full p-2 border border-gray-300 rounded-md text-sm" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" name="location" value={editFormData.location} onChange={handleEditChange} required className="w-full p-2 border border-gray-300 rounded-md uppercase text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" name="address" value={editFormData.address} onChange={handleEditChange} required className="w-full p-2 border border-gray-300 rounded-md uppercase text-sm" />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setEditingPermit(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm cursor-pointer">
                  {isSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PermitList;