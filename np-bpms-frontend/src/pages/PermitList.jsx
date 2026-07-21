import React, { useState, useEffect } from 'react';

const PermitList = () => {
  // --- INVISIBLE ADMIN CHECK ---
  // Silently checks the browser memory to see if you logged in via the /new-permit page
  const adminKey = localStorage.getItem('x-admin-key');
  const isAdmin = adminKey === 'supersecret123';

  const [permits, setPermits] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal States
  const [selectedPermit, setSelectedPermit] = useState(null); // For Viewing Files
  const [editingPermit, setEditingPermit] = useState(null);   // For Editing Data
  const [editFormData, setEditFormData] = useState({});       // Holds the form input
  const [isSaving, setIsSaving] = useState(false);            // Loading state for save button

  useEffect(() => {
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
    fetchPermits();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this permit record? This cannot be undone.")) return;

    try {
      const response = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/${id}`, {
        method: "DELETE",
        headers: {
          'x-admin-key': adminKey || '' // Silently attach the key to bypass the backend lock
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setPermits(permits.filter(permit => permit.id !== id));
      } else {
        alert("Failed to delete record. Access Denied.");
      }
    } catch (err) {
      alert("Server connection error.");
    }
  };

  // --- EDIT FUNCTIONS ---
  const handleEditClick = (permit) => {
    setEditFormData({
      permit_number: permit.permit_number,
      date_issued: permit.date_issued,
      first_name: permit.first_name,
      last_name: permit.last_name,
      phone: permit.phone || '',
      address: permit.address,
      location: permit.location
    });
    setEditingPermit(permit);
  };

  const handleEditChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const response = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/${editingPermit.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '' // Silently attach the key to bypass the backend lock
        },
        body: JSON.stringify(editFormData)
      });
      const data = await response.json();
      
      if (data.success) {
        setPermits(permits.map(p => p.id === editingPermit.id ? { ...p, ...editFormData } : p));
        setEditingPermit(null);
      } else {
        alert("Failed to update record. Access Denied.");
      }
    } catch (err) {
      alert("Server connection error.");
    } finally {
      setIsSaving(false);
    }
  };
  // -------------------------

  const filteredPermits = permits.filter(permit => {
    const search = searchTerm.toLowerCase();
    return (
      permit.permit_number?.toLowerCase().includes(search) ||
      permit.first_name?.toLowerCase().includes(search) ||
      permit.last_name?.toLowerCase().includes(search) ||
      permit.phone?.includes(search)
    );
  });

  const renderLinks = (linkString, label) => {
    if (!linkString) return null;
    const links = linkString.split(',').map(link => link.trim());
    if (links.length === 1) {
      return (
        <a href={links[0]} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:text-blue-800 text-sm mb-1 hover:underline">
          📄 View {label}
        </a>
      );
    }
    return (
      <div className="mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase">{label}S ({links.length}):</span>
        <div className="flex flex-wrap gap-2 mt-2">
          {links.map((link, index) => (
            <a key={index} href={link} target="_blank" rel="noopener noreferrer" className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded text-sm hover:underline border border-blue-100">
              Part {index + 1}
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          {/* Clean title with no lock button! */}
          <h1 className="text-2xl font-bold text-gray-900">Archive Vault Records</h1>
          <p className="text-sm text-gray-500 mt-1">Search, update, and retrieve historical building permits.</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* The magic button: Only renders if you are logged in */}
          {isAdmin && (
            <a href="/new-permit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-medium">
              + Add New Permit
            </a>
          )}
          <div className="w-72">
            <input 
              type="text" 
              placeholder="Search permit #, name, or phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-700 text-sm border-b border-gray-200">
                <th className="p-4 font-semibold">Permit Info</th>
                <th className="p-4 font-semibold">Applicant</th>
                <th className="p-4 font-semibold">Property Details</th>
                <th className="p-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500">Loading secure records...</td></tr>
              ) : filteredPermits.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500">No records found matching your search.</td></tr>
              ) : (
                filteredPermits.map((permit) => (
                  <tr key={permit.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 align-middle">
                      <div className="font-bold text-gray-900">{permit.permit_number}</div>
                      <div className="text-sm text-gray-500">Issued: {permit.date_issued}</div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-semibold text-gray-800">{permit.first_name} {permit.last_name}</div>
                      <div className="text-sm text-gray-600">📞 {permit.phone || 'N/A'}</div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="text-sm text-gray-800"><span className="font-semibold text-gray-500">Address:</span> {permit.address || 'N/A'}</div>
                      <div className="text-sm text-gray-800 mt-0.5"><span className="font-semibold text-gray-500">Location:</span> {permit.location || 'N/A'}</div>
                    </td>
                    <td className="p-4 align-middle text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {/* Everyone can View */}
                        <button onClick={() => setSelectedPermit(permit)} className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded text-sm font-medium transition" title="View Documents">
                          👁️ View
                        </button>
                        
                        {/* The magic buttons: Only render if you are logged in */}
                        {isAdmin && (
                          <>
                            <button onClick={() => handleEditClick(permit)} className="bg-gray-50 text-gray-700 hover:bg-gray-700 hover:text-white px-3 py-1.5 rounded text-sm font-medium transition" title="Edit Details">
                              ✏️ Edit
                            </button>
                            <button onClick={() => handleDelete(permit.id)} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded text-sm font-medium transition" title="Delete Record">
                              🗑️ Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL 1: VIEW FILES --- */}
      {selectedPermit && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Archived Documents</h3>
                <p className="text-sm text-gray-500 mt-1">Permit Number: <span className="font-semibold">{selectedPermit.permit_number}</span></p>
              </div>
              <button onClick={() => setSelectedPermit(null)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-50">
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
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDIT DATA --- */}
      {editingPermit && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Edit Permit Record</h3>
              <button onClick={() => setEditingPermit(null)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition">
                ✕
              </button>
            </div>
            
            <form onSubmit={submitEdit} className="p-6 overflow-y-auto bg-white space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Permit Number</label><input type="text" name="permit_number" value={editFormData.permit_number} onChange={handleEditChange} required className="w-full p-2 border rounded-md" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date Issued</label><input type="date" name="date_issued" value={editFormData.date_issued} onChange={handleEditChange} required className="w-full p-2 border rounded-md" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><input type="text" name="first_name" value={editFormData.first_name} onChange={handleEditChange} required className="w-full p-2 border rounded-md" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input type="text" name="last_name" value={editFormData.last_name} onChange={handleEditChange} required className="w-full p-2 border rounded-md" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" name="phone" value={editFormData.phone} onChange={handleEditChange} className="w-full p-2 border rounded-md" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input type="text" name="address" value={editFormData.address} onChange={handleEditChange} required className="w-full p-2 border rounded-md" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label><input type="text" name="location" value={editFormData.location} onChange={handleEditChange} required className="w-full p-2 border rounded-md" /></div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setEditingPermit(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
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