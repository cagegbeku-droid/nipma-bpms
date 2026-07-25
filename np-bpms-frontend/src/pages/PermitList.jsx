import React, { useState, useEffect } from 'react';

const PermitList = () => {
  const [permits, setPermits] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPermit, setSelectedPermit] = useState(null); // For Preview Modal

  useEffect(() => {
    fetchPermits();
  }, []);

  const fetchPermits = async () => {
    try {
      const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits");
      const data = await response.json();
      if (data.success) {
        setPermits(data.data);
      }
    } catch (err) {
      console.error("Error fetching permits:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPermits = permits.filter(permit => {
    const matchesSearch = 
      permit.permit_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permit.applicant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permit.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPurpose = selectedPurpose === 'ALL' || permit.purpose === selectedPurpose;

    return matchesSearch && matchesPurpose;
  });

  const exportToCSV = () => {
    if (filteredPermits.length === 0) return;
    
    const headers = ["Permit Number", "Applicant Name", "Date Issued", "Purpose", "Location", "Address"];
    const rows = filteredPermits.map(p => [
      `"${p.permit_number}"`,
      `"${p.applicant_name}"`,
      `"${p.date_issued ? p.date_issued.split('T')[0] : ''}"`,
      `"${p.purpose}"`,
      `"${p.location}"`,
      `"${p.address || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NiPDA_Permit_Registry_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historical Permit Registry</h1>
          <p className="text-xs text-gray-500">Search and view archived municipal permits.</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-md text-sm transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>📊 Export to CSV / Excel</span>
        </button>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
        <input 
          type="text" 
          placeholder="Search by Permit #, Applicant, or Location..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 p-2.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-600"
        />
        <select 
          value={selectedPurpose} 
          onChange={(e) => setSelectedPurpose(e.target.value)}
          className="p-2.5 border border-gray-300 rounded-md text-sm bg-white"
        >
          <option value="ALL">All Purposes</option>
          <option value="RESIDENTIAL">RESIDENTIAL</option>
          <option value="COMMERCIAL">COMMERCIAL</option>
          <option value="INSTITUTION">INSTITUTION</option>
          <option value="ORGANIZATION">ORGANIZATION</option>
          <option value="MIXED USE">MIXED USE</option>
          <option value="FENCE WALL">FENCE WALL</option>
        </select>
      </div>

      {/* Registry Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Loading archive registry...</div>
        ) : filteredPermits.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No matching permit records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase">
                  <th className="py-3 px-4">Permit Number</th>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Date Issued</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm text-gray-700">
                {filteredPermits.map(permit => (
                  <tr key={permit.id} className="hover:bg-gray-50 transition">
                    <td className="py-3 px-4 font-bold text-gray-900">{permit.permit_number}</td>
                    <td className="py-3 px-4 uppercase">{permit.applicant_name}</td>
                    <td className="py-3 px-4">{permit.date_issued ? permit.date_issued.split('T')[0] : 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-md font-medium">
                        {permit.purpose}
                      </span>
                    </td>
                    <td className="py-3 px-4 uppercase">{permit.location}</td>
                    <td className="py-3 px-4 text-right">
                      <button 
                        onClick={() => setSelectedPermit(permit)}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1 rounded text-xs transition cursor-pointer"
                      >
                        👁️ Preview Files
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IN-BROWSER DOCUMENT PREVIEW MODAL */}
      {selectedPermit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden border border-gray-200">
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{selectedPermit.permit_number}</h3>
                <p className="text-xs text-gray-400">{selectedPermit.applicant_name} • {selectedPermit.location}</p>
              </div>
              <button 
                onClick={() => setSelectedPermit(null)} 
                className="text-gray-400 hover:text-white font-bold text-lg px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <h4 className="font-bold text-sm text-gray-800 border-b pb-1">Archived Document Links</h4>
              {selectedPermit.files && selectedPermit.files.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedPermit.files.map((f, idx) => (
                    <a 
                      key={idx}
                      href={f.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg text-sm flex items-center justify-between text-blue-600 font-medium transition"
                    >
                      <span className="truncate pr-2">📄 {f.file_name || f.document_type || `Document ${idx+1}`}</span>
                      <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">Open ↗</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">No digital files attached to this record.</p>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t text-right">
              <button 
                onClick={() => setSelectedPermit(null)} 
                className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-900 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermitList;