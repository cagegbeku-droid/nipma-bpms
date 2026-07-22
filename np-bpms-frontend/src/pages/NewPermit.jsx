import React, { useState, useEffect } from 'react';
import DocumentScanner from '../DocumentScanner';

const NewPermit = () => {
  // --- SECRET ADMIN LOGIN STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('x-admin-key') === 'supersecret123') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const pass = e.target.password.value;
    if (pass === 'supersecret123') {
      localStorage.setItem('x-admin-key', pass);
      setIsAuthenticated(true);
    } else {
      alert('Access Denied. Incorrect Passcode.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('x-admin-key');
    setIsAuthenticated(false);
  };
  // ---------------------------------

  const [formData, setFormData] = useState({
    permitNumber: '', 
    dateIssued: '', 
    purpose: 'RESIDENTIAL', 
    customPurpose: '',
    applicantName: '', 
    phone: '', 
    address: '', 
    location: ''
  });
  
  const [files, setFiles] = useState({ certificate: [], drawings: [], permitForm: [], receipts: [] });
  const [message, setMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanField, setCurrentScanField] = useState(null);

  // Automatically transform text input values to uppercase
  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: name === 'dateIssued' || name === 'phone' ? value : value.toUpperCase() 
    });
  };

  const handleFileChange = (e) => {
    const fieldName = e.target.name;
    const newFiles = Array.from(e.target.files);
    if (!files[fieldName]) return; 
    setFiles(prev => ({ ...prev, [fieldName]: [...prev[fieldName], ...newFiles] }));
  };

  const handleScanSave = (file) => {
    setFiles(prev => ({ ...prev, [currentScanField]: [...prev[currentScanField], file] }));
    setIsScanning(false);
    setCurrentScanField(null);
  };

  const removeFile = (fieldName, indexToRemove) => {
    setFiles(prev => ({ ...prev, [fieldName]: prev[fieldName].filter((_, index) => index !== indexToRemove) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Uploading files to Archive Vault...");
    
    // Determine the final purpose value (if OTHER, use customPurpose)
    const finalPurposeValue = formData.purpose === 'OTHER' ? formData.customPurpose : formData.purpose;

    const submitData = new FormData();
    Object.keys(formData).forEach(key => {
      if (key !== 'customPurpose') {
        submitData.append(key, key === 'purpose' ? finalPurposeValue : formData[key]);
      }
    });
    
    Object.keys(files).forEach(key => {
      files[key].forEach(file => submitData.append(key, file));
    });

    try {
      const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/archive", {
        method: "POST",
        headers: {
          'x-admin-key': localStorage.getItem('x-admin-key')
        },
        body: submitData
      });
      const data = await response.json();
      if (data.success) {
        setMessage("Success! Record and all documents archived securely.");
        setFormData({ permitNumber: '', dateIssued: '', purpose: 'RESIDENTIAL', customPurpose: '', applicantName: '', phone: '', address: '', location: '' });
        setFiles({ certificate: [], drawings: [], permitForm: [], receipts: [] });
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
            <input type="file" name={fieldName} multiple={allowMultiple} onChange={handleFileChange} className="hidden" />
          </label>
          <button type="button" onClick={() => { setCurrentScanField(fieldName); setIsScanning(true); }} className="bg-blue-50 text-blue-700 font-semibold py-2 px-4 rounded-md hover:bg-blue-100 transition text-sm flex items-center">
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

  // --- IF NOT LOGGED IN, SHOW THIS SCREEN INSTEAD ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-md w-96 max-w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Restricted Area</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" name="password" required placeholder="Enter Admin Passcode" className="w-full p-3 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-3 rounded-md hover:bg-blue-700 transition">Access System</button>
          </form>
        </div>
      </div>
    );
  }

  // --- NORMAL RENDER ---
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Archive Historical Permit</h1>
        <button onClick={handleLogout} className="text-sm text-red-500 hover:underline">Logout & Lock System</button>
      </div>
      
      {message && <div className={"p-4 mb-6 rounded-md font-medium " + (message.includes("Success") ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}> {message} </div>}
      
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">1. Permit Data</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Original Permit Number</label>
              <input type="text" name="permitNumber" value={formData.permitNumber} onChange={handleTextChange} required className="w-full p-2 border rounded-md uppercase" placeholder="E.G., NiPDA/DAWH/20/001"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Issued</label>
              <input type="date" name="dateIssued" value={formData.dateIssued} onChange={handleTextChange} required className="w-full p-2 border rounded-md" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Building Purpose / Use</label>
              <select 
                name="purpose" 
                value={formData.purpose} 
                onChange={handleTextChange} 
                required 
                className="w-full p-2 border rounded-md bg-white uppercase"
              >
                <option value="RESIDENTIAL">RESIDENTIAL</option>
                <option value="COMMERCIAL">COMMERCIAL</option>
                <option value="INSTITUTION">INSTITUTION</option>
                <option value="ORGANIZATION">ORGANIZATION</option>
                <option value="MIXED USE">MIXED USE</option>
                <option value="FENCE WALL">FENCE WALL</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            {formData.purpose === 'OTHER' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Specify Other Purpose</label>
                <input 
                  type="text" 
                  name="customPurpose" 
                  value={formData.customPurpose} 
                  onChange={handleTextChange} 
                  required 
                  className="w-full p-2 border rounded-md uppercase" 
                  placeholder="E.G., INDUSTRIAL WAREHOUSE" 
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">2. Applicant & Property</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Applicant / Organization Name</label>
              <input type="text" name="applicantName" value={formData.applicantName} onChange={handleTextChange} required className="w-full p-2 border rounded-md uppercase" placeholder="E.G., JOHN & MARY DOE / ST. PETER'S METHODIST CHURCH" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleTextChange} className="w-full p-2 border rounded-md" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Community</label>
              <input type="text" name="location" value={formData.location} onChange={handleTextChange} required className="w-full p-2 border rounded-md uppercase" placeholder="E.G., PRAMPRAM" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address / Plot Description</label>
              <input type="text" name="address" value={formData.address} onChange={handleTextChange} required className="w-full p-2 border rounded-md uppercase" placeholder="E.G., PLOT 12, BLOCK B" />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">3. Document Vault</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-lg border border-gray-200">
            {renderDocumentUpload("Permit Certificate", "certificate", false)}
            {renderDocumentUpload("Architectural Drawings", "drawings", true)}
            {renderDocumentUpload("Permit Form", "permitForm", true)}
            {renderDocumentUpload("Receipts", "receipts", true)}
          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-4 rounded-md hover:bg-blue-700 transition shadow-md">
          Save to Secure Archives
        </button>
      </form>

      {isScanning && (
        <DocumentScanner documentTitle={currentScanField} onCancel={() => setIsScanning(false)} onSave={handleScanSave} />
      )}
    </div>
  );
};

export default NewPermit;