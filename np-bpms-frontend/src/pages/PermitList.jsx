import React, { useState, useEffect } from 'react';

const PermitList = () => {
  const [permits, setPermits] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
          📄 {label}
        </a>
      );
    }

    return (
      <div className="mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase">{label}S ({links.length}):</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {links.map((link, index) => (
            <a key={index} href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm hover:underline">
              [Part {index + 1}]
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
                <th className="p-4 font-semibold">Archived Documents</th>
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
                    
                    <td className="p-4 align-top">
                      <div className="font-bold text-gray-900">{permit.permit_number}</div>
                      <div className="text-sm text-gray-500">Issued: {permit.date_issued}</div>
                    </td>
                    
                    <td className="p-4 align-top">
                      <div className="font-semibold text-gray-800">{permit.first_name} {permit.last_name}</div>
                      <div className="text-sm text-gray-600">📞 {permit.phone}</div>
                    </td>
                    
                    <td className="p-4 align-top">
                      <div className="text-sm text-gray-800"><span className="font-semibold">Plot:</span> {permit.plot_number}</div>
                      <div className="text-sm text-gray-800"><span className="font-semibold">Loc:</span> {permit.community}</div>
                      <div className="text-xs inline-block bg-gray-200 text-gray-700 px-2 py-1 rounded mt-1">{permit.building_type}</div>
                    </td>
                    
                    <td className="p-4 align-top bg-blue-50/30">
                      {renderLinks(permit.certificate_link, "Certificate")}
                      {renderLinks(permit.drawings_links, "Drawing")}
                      {renderLinks(permit.indenture_link, "Indenture")}
                      {renderLinks(permit.receipts_links, "Receipt")}
                      {renderLinks(permit.georef_link, "GeoRef")}
                      
                      {(!permit.certificate_link && !permit.drawings_links && !permit.indenture_link && !permit.receipts_links && !permit.georef_link) && (
                        <span className="text-sm text-gray-400 italic">No files attached</span>
                      )}
                    </td>
                    
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PermitList;