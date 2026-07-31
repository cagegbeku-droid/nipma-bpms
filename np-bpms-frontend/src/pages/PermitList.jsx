import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PermitQRBadge from '../components/PermitQRBadge';

const PermitList = () => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const savedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  
  const roleStr = (user?.role || '').toLowerCase();
  const isOfficer = Boolean(
    token && user && (
      !user.role || 
      roleStr === 'uploader' || 
      roleStr === 'admin' || 
      roleStr === 'officer' || 
      roleStr === 'staff'
    )
  );

  const [permits, setPermits] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedPermit, setSelectedPermit] = useState(null); 
  const [editingPermit, setEditingPermit] = useState(null);   
  const [editFormData, setEditFormData] = useState({});       
  const [isSaving, setIsSaving] = useState(false);            

  const [viewerDoc, setViewerDoc] = useState({ isOpen: false, url: '', title: '' });
  const [qrModal, setQrModal] = useState({ isOpen: false, code: '', permitNum: '', applicantName: '' });

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
        setError("Failed to load records from the database.");
      }
    } catch (err) {
      setError("Server connection error. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this permit record? This cannot be undone.")) return;

    try {
      const response = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/${id}`, {
        method: "DELETE",
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setPermits(permits.filter(permit => permit.id !== id));
      } else {
        alert(data.message || "Failed to delete record. Permission denied.");
      }
    } catch (err) {
      alert("Server connection error.");
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
        alert("Could not generate QR Badge.");
      }
    } catch (err) {
      console.error("QR Code Fetch Error:", err);
      alert("Error generating QR Badge.");
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

      const matchesSearch = !search || (
        permit.permit_number?.toLowerCase().includes(search) ||
        applicantName.toLowerCase().includes(search) ||
        permit.purpose?.toLowerCase().includes(search) ||
        permit.location?.toLowerCase().includes(search) ||
        permit.address?.toLowerCase().includes(search) ||
        permit.phone?.includes(search)
      );

      return matchesMonth && matchesYear && matchesSearch;
    });
  }, [permits, searchTerm, selectedMonth, selectedYear]);

  const exportToCSV = () => {
    if (filteredPermits.length === 0) return;

    const headers = ["Permit Number", "Applicant Name", "Date Issued", "Purpose", "Location", "Phone", "Address"];
    const rows = filteredPermits.map(p => {
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
    link.setAttribute("download", `NiPDA_Permit_Registry_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    setEditFormData({ 
      ...editFormData, 
      [name]: name === 'date_issued' || name === 'phone' ? value : value.toUpperCase() 
    });
  };

  const handlePermitNumberBlur = () => {
    const formatted = formatPermitNumberInput(editFormData.permit_number);
    setEditFormData(prev => ({ ...prev, permit_number: formatted }));
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const finalPurpose = editFormData.purpose === 'OTHER' ? editFormData.custom_purpose : editFormData.purpose;
    const payload = {
      permit_number: formatPermitNumberInput(editFormData.permit_number),
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
      
      if (data.success) {
        setPermits(permits.map(p => p.id === editingPermit.id ? { ...p, ...payload } : p));
        setEditingPermit(null);
      } else {
        alert(data.message || "Failed to update record. Permission denied.");
      }
    } catch (err) {
      alert("Server connection error.");
    } finally {
      setIsSaving(false);
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
    const links = linkString.split(',').map(link => link.trim());
    if (links.length === 1) {
      return (
        <button 
          onClick={() => handleOpenDocViewer(links[0], `${label} - ${selectedPermit?.permit_number}`)}
          className="block text-blue-600 hover:text-blue-800 text-sm mb-1 hover:underline font-medium text-left cursor-pointer"
        >
          📄 View {label}
        </button>
      );
    }
    return (
      <div className="mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase">{label}S ({links.length}):</span>
        <div className="flex flex-wrap gap-2 mt-2">
          {links.map((link, index) => (
            <button 
              key={index} 
              onClick={() => handleOpenDocViewer(link, `${label} Part ${index + 1} - ${selectedPermit?.permit_number}`)}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded text-sm hover:underline border border-blue-100 font-medium cursor-pointer"
            >
              Part {index + 1}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archive Vault Records</h1>
          <p className="text-sm text-gray-500 mt-1">Search, update, and retrieve historical building permits.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-md transition text-sm font-medium flex items-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <span>📊 Export CSV</span>
          </button>

          {isOfficer && (
            <Link to="/permits/new" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-medium whitespace-nowrap">
              + Add New Permit
            </Link>
          )}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Search Keywords</label>
          <input 
            type="text" 
            placeholder="Search permit #, applicant name, location, address..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Filter by Month</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">All Months (Jan - Dec)</option>
            <option value="01">January</option>
            <option value="02">February</option>
            <option value="03">March</option>
            <option value="04">April</option>
            <option value="05">May</option>
            <option value="06">June</option>
            <option value="07">July</option>
            <option value="08">August</option>
            <option value="09">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Filter by Year</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">All Years</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-md">{error}</div>}

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-700 text-sm border-b border-gray-200">
                <th className="p-4 font-semibold">Permit Info</th>
                <th className="p-4 font-semibold">Applicant / Entity</th>
                <th className="p-4 font-semibold">Property Details & GPS Map</th>
                <th className="p-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500">Loading secure records...</td></tr>
              ) : filteredPermits.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500">No records found matching your filters.</td></tr>
              ) : (
                filteredPermits.map((permit) => {
                  const displayName = permit.applicant_name || `${permit.first_name || ''} ${permit.last_name || ''}`.trim();
                  const displayPurpose = permit.purpose || 'RESIDENTIAL';

                  return (
                    <tr key={permit.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 align-middle">
                        <div className="font-bold text-gray-900">{permit.permit_number}</div>
                        <div className="text-xs text-blue-600 font-semibold uppercase mt-0.5">{displayPurpose}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Issued: {permit.date_issued}</div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="font-semibold text-gray-800 uppercase">{displayName}</div>
                        <div className="text-sm text-gray-600 mt-0.5">📞 {permit.phone || 'N/A'}</div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="text-sm text-gray-800 uppercase">
                          <span className="font-semibold text-gray-500">Location:</span> {permit.location || 'N/A'}
                        </div>

                        <div className="text-sm uppercase mt-1">
                          <span className="font-semibold text-gray-500">Address:</span>{' '}
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
                      <td className="p-4 align-middle text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button onClick={() => setSelectedPermit(permit)} className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded text-sm font-medium transition cursor-pointer" title="View Documents">
                            👁️ View
                          </button>

                          <button onClick={() => handleShowQrBadge(permit)} className="bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded text-sm font-medium transition cursor-pointer" title="Print QR Badge">
                            🖨️ Badge
                          </button>
                          
                          {isOfficer && (
                            <>
                              <button onClick={() => handleEditClick(permit)} className="bg-gray-100 text-gray-700 hover:bg-gray-800 hover:text-white px-3 py-1.5 rounded text-sm font-medium transition cursor-pointer" title="Edit Details">
                                ✏️ Edit
                              </button>
                              <button onClick={() => handleDelete(permit.id)} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded text-sm font-medium transition cursor-pointer" title="Delete Record">
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
      </div>

      {/* VIEW DOCUMENTS MODAL */}
      {selectedPermit && (() => {
        const modalName = selectedPermit.applicant_name || `${selectedPermit.first_name || ''} ${selectedPermit.last_name || ''}`.trim();
        const modalPurpose = selectedPermit.purpose || 'RESIDENTIAL';

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Archived Documents & Details</h3>
                  <p className="text-sm text-gray-500 mt-1">Permit Number: <span className="font-semibold">{selectedPermit.permit_number}</span></p>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-gray-700 mb-2 border-b pb-2">Certificate</h4>
                    {renderLinks(selectedPermit.certificate_link, "Certificate") || <span className="text-sm text-gray-400 italic">Not uploaded</span>}
                  </div>
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-gray-700 mb-2 border-b pb-2">Architectural Drawings</h4>
                    {renderLinks(selectedPermit.drawings_links, "Drawing") || <span className="text-sm text-gray-400 italic">Not uploaded</span>}
                  </div>
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-gray-700 mb-2 border-b pb-2">Permit Form</h4>
                    {renderLinks(selectedPermit.permit_form_link, "Form") || <span className="text-sm text-gray-400 italic">Not uploaded</span>}
                  </div>
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-gray-700 mb-2 border-b pb-2">Receipts</h4>
                    {renderLinks(selectedPermit.receipts_links, "Receipt") || <span className="text-sm text-gray-400 italic">Not uploaded</span>}
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

      {/* DOCUMENT VIEWER MODAL */}
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
              <span>NIPDA BPMS Secure Document Vault</span>
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

      {/* PRINTABLE & DOWNLOADABLE QR BADGE MODAL */}
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

      {/* EDIT MODAL */}
      {editingPermit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Edit Permit Record</h3>
              <button onClick={() => setEditingPermit(null)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition cursor-pointer">
                ✕
              </button>
            </div>
            
            <form onSubmit={submitEdit} className="p-6 overflow-y-auto bg-white space-y-4">
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
                    placeholder="E.G., PRAM2517"
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
                  {isSaving ? 'Saving...' : 'Save Changes'}
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