
import React, { useEffect, useState } from 'react';
import { DocumentIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const PermitList = () => {
  const [permits, setPermits] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermits = async () => {
      try {
        const response = await fetch("http://192.168.242.218:5000/api/permits");
        const data = await response.json();
        if (data.success) {
          setPermits(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch permits", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPermits();
  }, []);

  const getFileUrl = (filePath) => {
    if (!filePath) return null;
    return "http://192.168.242.218:5000/" + filePath.replace(/\\/g, '/');
  };

  const documentTypes = [
    { key: 'file_permit_certificate', label: 'Certificate' },
    { key: 'file_architectural_drawings', label: 'Drawings' },
    { key: 'file_site_plan', label: 'Site Plan' },
    { key: 'file_permit_form', label: 'Permit Form' },
    { key: 'file_receipts', label: 'Receipts' },
    { key: 'file_jacket', label: 'Jacket' },
    { key: 'file_indenture', label: 'Indenture' },
    { key: 'file_geo_reference', label: 'Geo-Ref' }
  ];

  // --- SEARCH FILTERING LOGIC ---
  const filteredPermits = permits.filter((permit) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = permit.first_name + " " + permit.last_name;
    return (
      permit.permit_number.toLowerCase().includes(searchLower) ||
      fullName.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-end mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Archival Registry</h1>
        
        {/* The Search Bar */}
        <div className="relative w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search permit # or name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 text-sm font-semibold text-gray-600 whitespace-nowrap">Permit #</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Applicant</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Plot & Type</th>
                <th className="p-4 text-sm font-semibold text-gray-600 whitespace-nowrap">Date Issued</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Archived Documents Vault</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="5" className="p-4 text-center text-gray-500">Loading records...</td></tr>
              ) : filteredPermits.length === 0 ? (
                <tr><td colSpan="5" className="p-4 text-center text-gray-500">No records match your search.</td></tr>
              ) : (
                // Render the FILTERED permits instead of all permits!
                filteredPermits.map((permit) => (
                  <tr key={permit.permit_number} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-sm font-medium text-blue-600 whitespace-nowrap">{permit.permit_number}</td>
                    <td className="p-4 text-sm text-gray-600">{permit.first_name} {permit.last_name}</td>
                    <td className="p-4 text-sm text-gray-600">{permit.plot_number} - {permit.building_type}</td>
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{permit.date_issued}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {documentTypes.map(doc => permit[doc.key] ? (
                          <a 
                            key={doc.key}
                            href={getFileUrl(permit[doc.key])} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 px-2 py-1 rounded-md text-xs font-medium transition-colors duration-150"
                          >
                            <DocumentIcon className="h-3 w-3 mr-1" /> {doc.label}
                          </a>
                        ) : null)}
                        {!documentTypes.some(doc => permit[doc.key]) && (
                          <span className="text-xs text-gray-400 italic">No documents attached</span>
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
    </div>
  );
};

export default PermitList;
