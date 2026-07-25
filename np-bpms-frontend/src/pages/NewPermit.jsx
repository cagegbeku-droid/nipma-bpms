import React, { useState, useEffect } from 'react';
import Login from './Login';

const NewPermit = () => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    setMessage("Uploading files to Secure Archive Vault...");
    
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
      const token = localStorage.getItem('token');
      const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/archive", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submitData
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setMessage("Success! Record and all documents archived securely.");
        setFormData({ permitNumber: '', dateIssued: '', purpose: 'RESIDENTIAL', customPurpose: '', applicantName: '', phone: '', address: '', location: '' });
        setFiles({ certificate: [], drawings: [], permitForm: [], receipts: [] });
        
        setTimeout(() => {
          setMessage('');
        }, 4000);
      } else {
        setMessage(data.message || "Failed to archive record. Permission denied or invalid input.");
      }
    } catch (error) {
      setMessage("Server connection error. Please check your network.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDocumentUpload = (label, fieldName, allowMultiple = true) => {
    const currentFiles = files[fieldName] || []; 
    return (
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-2">
        <label className="block text-sm font-bold text-gray-800">{label}</label>
        <p className="text-xs text-gray-500 mb-2">Upload scanned PDFs or images</p>
        
        <label className={`cursor-pointer bg-blue-50 text-blue-700 font-semibold py-2.5 px-4 rounded-md hover:bg-blue-100 transition text-sm flex items-center justify-center border border-blue-200 ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}>
          <span>📁 Browse & Select {allowMultiple ? 'Scanned Documents' : 'Scanned Document'}</span>
          <input 
            type="file" 
            name={fieldName} 
            multiple={allowMultiple} 
            accept=".pdf,image/*" 
            onChange={handleFileChange} 
            disabled={isSubmitting}
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
                  disabled={isSubmitting}
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

  // --- SHOW LOGIN IF NOT LOGGED IN OR NOT AN UPLOADER ---
  if (!currentUser || (currentUser.role !== 'uploader' && currentUser.role !== 'admin')) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archive Historical Permit</h1>
          <p className="text-xs text-gray-500">Logged in as: <span className="font-semibold text-gray-700">{currentUser.name} ({currentUser.email})</span></p>
        </div>
        <button onClick={handleLogout} className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded border border-red-200 font-medium hover:bg-red-100 transition">
          Logout
        </button>
      </div>
      
      {message && (
        <div className={"p-4 mb-6 rounded-md font-medium transition-all shadow-sm " + (message.includes("Success") ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200")}> 
          {message} 
        </div>
      )}
      
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
                disabled={isSubmitting}
                className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50" 
                placeholder="E.G., LAK-NIN2630 or NIPDA/LAK-NIN/26/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Issued</label>
              <input type="date" name="dateIssued" value={formData.dateIssued} onChange={handleTextChange} required disabled={isSubmitting} className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Building Purpose / Use</label>
              <select 
                name="purpose" 
                value={formData.purpose} 
                onChange={handleTextChange} 
                required 
                disabled={isSubmitting}
                className="w-full p-2 border border-gray-300 rounded-md bg-white uppercase disabled:bg-gray-50"
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
                  disabled={isSubmitting}
                  className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50" 
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
              <input type="text" name="applicantName" value={formData.applicantName} onChange={handleTextChange} required disabled={isSubmitting} className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50" placeholder="E.G., JOHN & MARY DOE / ST. PETER'S METHODIST CHURCH" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleTextChange} disabled={isSubmitting} className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-50" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Community</label>
              <input type="text" name="location" value={formData.location} onChange={handleTextChange} required disabled={isSubmitting} className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50" placeholder="E.G., PRAMPRAM" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address / Plot Description</label>
              <input type="text" name="address" value={formData.address} onChange={handleTextChange} required disabled={isSubmitting} className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50" placeholder="E.G., PLOT 12, BLOCK B" />
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

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white font-semibold py-4 rounded-md hover:bg-blue-700 transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-70 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Archiving Documents...</span>
            </>
          ) : (
            <span>Save to Secure Archives</span>
          )}
        </button>
      </form>
    </div>
  );
};

export default NewPermit;