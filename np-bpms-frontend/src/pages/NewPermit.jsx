import React, { useState, useEffect } from 'react';

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

  // --- AUTO-FORMATTER HELPER FOR PERMIT NUMBER ---
  const formatPermitNumberInput = (value) => {
    const cleanVal = (value || '').trim().toUpperCase();
    if (cleanVal.startsWith('NIPDA/')) {
      return cleanVal;
    }
    const match = cleanVal.match(/^([A-Z\-\/]+?)(\d{2})(\d{1,4})$/);
    if (match) {
      let [, location, year, serial] = match;
      location = location.replace(/[\/\-]+$/, '');
      return `NIPDA/${location}/${year}/${serial}`;
    }
    return cleanVal;
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: name === 'dateIssued' || name === 'phone' ? value : value.toUpperCase() 
    });
  };

  const handlePermitNumberBlur = () => {
    const formatted = formatPermitNumberInput(formData.permitNumber);
    setFormData(prev => ({ ...prev, permitNumber: formatted }));
  };

  const handleFileChange = (e) => {
    const fieldName = e.target.name;
    const newFiles = Array.from(e.target.files);
    if (!files[fieldName]) return; 
    setFiles(prev => ({ ...prev, [fieldName]: [...prev[fieldName], ...newFiles] }));
  };

  const removeFile = (fieldName, indexToRemove) => {
    setFiles(prev => ({ ...prev, [fieldName]: prev[fieldName].filter((_, index) => index !== indexToRemove) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Uploading files to Archive Vault...");
    
    const formattedPermitNumber = formatPermitNumberInput(formData.permitNumber);
    const finalPurposeValue = formData.purpose === 'OTHER' ? formData.customPurpose : formData.purpose;

    const submitData = new FormData();
    Object.keys(formData).forEach(key => {
      if (key !== 'customPurpose') {
        if (key === 'permitNumber') {
          submitData.append(key, formattedPermitNumber);
        } else {
          submitData.append(key, key === 'purpose' ? finalPurposeValue : formData[key]);
        }
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

  const renderDocumentUpload = (label, fieldName, allowMultiple = true) => {
    const currentFiles = files[fieldName] || []; 
    return (
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <label className="block text-sm font-bold text-gray-800 mb-2">{label}</label>
        <p className="text-xs text-gray-500 mb-3">Upload scanned PDFs or images (multi-page supported)</p>
        
        <label className="cursor-pointer bg-blue-50 text-blue-700 font-semibold py-2.5 px-4 rounded-md hover:bg-blue-100 transition text-sm flex items-center justify-center border border-blue-200">
          <span>📁 Browse & Select {allowMultiple ? 'Documents' : 'Document'}</span>
          <input 
            type="file" 
            name={fieldName} 
            multiple={allowMultiple} 
            accept=".pdf,image/*" 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </label>

        {currentFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {currentFiles.map((file, index) => (
              <div key={index} className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-200 text-sm">
                <span className="truncate pr-2 font-medium text-gray-700">📄 {file.name}</span>
                <button 
                  type="button" 
                  onClick={() => removeFile(fieldName, index)} 
                  className="text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // --- IF NOT LOGGED IN ---
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
              <input 
                type="text" 
                name="permitNumber" 
                value={formData.permitNumber} 
                onChange={handleTextChange} 
                onBlur={handlePermitNumberBlur}
                required 
                className="w-full p-2 border rounded-md uppercase" 
                placeholder="E.G., LAK-NIN2630 or NIPDA/LAK-NIN/26/30"
              />
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
            {renderDocumentUpload("Receipts / Bill", "receipts", true)}
          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-4 rounded-md hover:bg-blue-700 transition shadow-md">
          Save to Secure Archives
        </button>
      </form>
    </div>
  );
};

export default NewPermit;