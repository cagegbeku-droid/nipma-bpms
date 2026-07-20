import React, { useState } from 'react';
import DocumentScanner from '../DocumentScanner'; // Assuming this path is correct for your setup

const NewPermit = () => {
  // Updated state for new text fields
  const [formData, setFormData] = useState({
    permitNumber: '', dateIssued: '', firstName: '', lastName: '', phone: '', address: '', location: ''
  });
  
  // Updated state replacing indenture with permitForm
  const [files, setFiles] = useState({
    certificate: [], drawings: [], permitForm: [], receipts: [], geoReference: []
  });
  
  const [message, setMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanField, setCurrentScanField] = useState(null);

  const handleTextChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const fieldName = e.target.name;
    const newFiles = Array.from(e.target.files);
    if (!files[fieldName]) return; 
    setFiles(prev => ({
      ...prev,
      [fieldName]: [...prev[fieldName], ...newFiles]
    }));
  };

  const handleScanSave = (file) => {
    setFiles(prev => ({
      ...prev,
      [currentScanField]: [...prev[currentScanField], file]
    }));
    setIsScanning(false);
    setCurrentScanField(null);
  };

  const removeFile = (fieldName, indexToRemove) => {
    setFiles(prev => ({
      ...prev,
      [fieldName]: prev[fieldName].filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Uploading files to Archive Vault...");
    
    const submitData = new FormData();
    Object.keys(formData).forEach(key => submitData.append(key, formData[key]));
    
    Object.keys(files).forEach(key => {
      files[key].forEach(file => {
        submitData.append(key, file);
      });
    });

    try {
      const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/archive", {
        method: "POST",
        body: submitData
      });
      const data = await response.json();
      if (data.success) {
        setMessage("Success! Record and all documents archived securely.");
        setFormData({ permitNumber: '', dateIssued: '', firstName: '', lastName: '', phone: '', address: '', location: '' });
        setFiles({ certificate: [], drawings: [], permitForm: [], receipts: [], geoReference: [] });
      } else {
        setMessage("Failed to archive record.");
      }
    } catch (error) {
      setMessage("Server connection error.");
    }
  };

  const renderDocumentUpload = (label, fieldName, allowMultiple = false) => {
    const currentFiles = files[fieldName] || []; 
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <label className="block text-sm font-bold text-gray-800 mb-3">{label}</label>
        
        <div className="flex space-x-3 mb-3">
          <label className="cursor-pointer bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-200 transition text-sm flex items-center">
            <span>📁 Upload {allowMultiple ? 'Files' : 'File'}</span>
            <input 
              type="file" 
              name={fieldName} 
              multiple={allowMultiple} 
              onChange={handleFileChange} 
              className="hidden" 
            />
          </label>

          <button 
            type="button" 
            onClick={() => { setCurrentScanField(fieldName); setIsScanning(true); }} 
            className="bg-blue-50 text-blue-700 font-semibold py-2 px-4 rounded-md hover:bg-blue-100 transition text-sm flex items-center">
            📷 Scan {allowMultiple ? 'Page' : 'Document'}
          </button>
        </div>

        {currentFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {currentFiles.map((file, index) => (
              <div key={index} className="flex justify-between items-center bg-green-50 p-2 rounded text-sm text-green-800">
                <span className="truncate pr-2">✓ {file.name}</span>
                <button type="button" onClick={() => removeFile(fieldName, index)} className="text-red-500 font-bold px-2 hover:bg-red-100 rounded">X</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Archive Historical Permit</h1>
      {message && <div className={"p-4 mb-6 rounded-md font-medium " + (message.includes("Success") ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}> {message} </div>}
      
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-8">
        
        {/* Metadata Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">1. Permit Data</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Original Permit Number</label><input type="text" name="permitNumber" value={formData.permitNumber} onChange={handleTextChange} required className="w-full p-2 border rounded-md" placeholder="e.g. NiPDA/DAWH/20/001"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date Issued</label><input type="date" name="dateIssued" value={formData.dateIssued} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
          </div>
        </div>

        {/* Applicant Section - Updated with Address and Location */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">2. Applicant & Property</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><input type="text" name="firstName" value={formData.firstName} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input type="text" name="lastName" value={formData.lastName} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" name="phone" value={formData.phone} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
            
            {/* New Address & Location Fields */}
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input type="text" name="address" value={formData.address} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label><input type="text" name="location" value={formData.location} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
          </div>
        </div>

        {/* Document Vault Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">3. Document Vault</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-lg border border-gray-200">
            {renderDocumentUpload("Permit Certificate", "certificate", false)}
            {renderDocumentUpload("Architectural Drawings", "drawings", true)}
            {/* Updated Field */}
            {renderDocumentUpload("Permit Form", "permitForm", true)}
            {renderDocumentUpload("Receipts", "receipts", true)}
            {renderDocumentUpload("Geo Reference", "geoReference", false)}
          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-4 rounded-md hover:bg-blue-700 transition shadow-md">
          Save to Secure Archives
        </button>
      </form>

      {isScanning && (
        <DocumentScanner 
          documentTitle={currentScanField} 
          onCancel={() => setIsScanning(false)} 
          onSave={handleScanSave} 
        />
      )}
    </div>
  );
};

export default NewPermit;