import React, { useState, useEffect } from 'react';

const PermitList = () => {
  const [permits, setPermits] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPermit, setSelectedPermit] = useState(null);

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
          <h1 className="text-2xl font-bold text-gray-900">Archive Vault Records</h1>
          <p className="text-sm text-gray-500 mt-1">Search and retrieve historical building permits.</p>
        </div>
        
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
                      <div className="text-sm text-gray-600">📞 {permit.phone}</div>
                    </td>
                    
                    {/* Cleaned up Property Details Column */}
                    <td className="p-4 align-middle">
                      <div className="text-sm text-gray-800"><span className="font-semibold text-gray-500">Address:</span> {permit.address || 'N/A'}</div>
                      <div className="text-sm text-gray-800 mt-0.5"><span className="font-semibold text-gray-500">Location:</span> {permit.location || 'N/A'}</div>
                    </td>
                    
                    <td className="p-4 align-middle text-center">
                      <button 
                        onClick={() => setSelectedPermit(permit)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow-sm"
                      >
                        View Files
                      </button>
                    </td>
                    
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>

      {selectedPermit && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Archived Documents</h3>
                <p className="text-sm text-gray-500 mt-1">Permit Number: <span className="font-semibold">{selectedPermit.permit_number}</span></p>
              </div>
              <button onClick={() => setSelectedPermit(null)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
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

                {/* Updated to Permit Form */}
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-gray-700 mb-2 border-b pb-2">Permit Form</h4>
                  {renderLinks(selectedPermit.permit_form_link, "Form") || <span className="text-sm text-gray-400 italic">Not uploaded</span>}
                </div>

                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-gray-700 mb-2 border-b pb-2">Receipts</h4>
                  {renderLinks(selectedPermit.receipts_links, "Receipt") || <span className="text-sm text-gray-400 italic">Not uploaded</span>}
                </div>

                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm md:col-span-2">
                  <h4 className="font-bold text-gray-700 mb-2 border-b pb-2">Geo-Reference Data</h4>
                  {renderLinks(selectedPermit.georef_link, "GeoRef Data") || <span className="text-sm text-gray-400 italic">Not uploaded</span>}
                </div>

              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end">
              <button onClick={() => setSelectedPermit(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-2 rounded-md font-medium transition">
                Close Vault
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default PermitList;