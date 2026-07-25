import React, { useState, useEffect } from 'react';
import Login from '../Login';

const NewPermit = () => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  // --- CLEAN LOGOUT & REDIRECT TO PUBLIC DASHBOARD ---
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('token_expiry');
    window.location.href = '/';
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
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'dateIssued' || name === 'phone' ? value : value.toUpperCase() 
    }));
  };

  // --- DUAL DUPLICATE CHECK: REQUIRES BOTH PERMIT NUMBER & DATE ISSUED TO MATCH ---
  const checkDuplicateRecord = async (permitNum, date) => {
    if (!permitNum || !date) return;
    
    try {
      const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits");
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        const duplicate = data.data.find(p => 
          p.permit_number?.toUpperCase().trim() === permitNum.toUpperCase().trim() &&
          p.date_issued && p.date_issued.split('T')[0] === date
        );

        if (duplicate) {
          setDuplicateWarning(`⚠️ Duplicate Warning: A permit with number "${permitNum}" issued on ${date} is already archived in the system.`);
        } else {
          setDuplicateWarning('');
        }
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
    }
  };

  const handlePermitBlurOrDateChange = () => {
    const formatted = formatPermitNumberInput(formData.permitNumber);
    setFormData(prev => ({ ...prev, permitNumber: formatted }));
    checkDuplicateRecord(formatted, formData.dateIssued);
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

  // --- PARALLEL DIRECT-TO-GOOGLE DRIVE UPLOAD HANDLER ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUploadProgress(0);
    setMessage("Uploading all documents directly to Google Drive in parallel...");

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        handleLogout();
        return;
      }

      // Helper function: Direct Upload with XHR Progress
      const uploadFileDirectToDrive = async (file) => {
        const sessionRes = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/get-drive-upload-url", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            fileName: file.name, 
            mimeType: file.type || 'application/pdf',
            fileSize: file.size
          })
        });

        if (sessionRes.status === 401 || sessionRes.status === 403) {
          alert("Your session has expired. Please log in again.");
          handleLogout();
          throw new Error("Session expired");
        }

        const sessionData = await sessionRes.json();
        if (!sessionData.success || !sessionData.uploadUrl) {
          throw new Error(sessionData.message || "Failed to create Google Drive session.");
        }

        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", sessionData.uploadUrl, true);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
              try {
                const resJson = JSON.parse(xhr.responseText);
                const driveFileUrl = `https://drive.google.com/file/d/${resJson.id}/view`;
                resolve(driveFileUrl);
              } catch (e) {
                resolve(sessionData.uploadUrl);
              }
            } else {
              reject(new Error(`Google Drive upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Network connection error during Google Drive upload."));
          xhr.send(file);
        });
      };

      // 1. Upload Certificate
      const certPromise = files.certificate.length > 0 
        ? uploadFileDirectToDrive(files.certificate[0]) 
        : Promise.resolve('');

      // 2. Upload Permit Form
      const formPromise = files.permitForm.length > 0 
        ? uploadFileDirectToDrive(files.permitForm[0]) 
        : Promise.resolve('');

      // 3. Upload Architectural Drawings (Parallel)
      const drawingsPromises = files.drawings.map(file => uploadFileDirectToDrive(file));

      // 4. Upload Receipts (Parallel)
      const receiptsPromises = files.receipts.map(file => uploadFileDirectToDrive(file));

      // EXECUTE ALL GOOGLE DRIVE UPLOADS SIMULTANEOUSLY
      const [certificateLink, permitFormLink, drawingsLinks, receiptsLinks] = await Promise.all([
        certPromise,
        formPromise,
        Promise.all(drawingsPromises),
        Promise.all(receiptsPromises)
      ]);

      // 5. Send lightweight metadata to Render backend database
      setMessage("Saving permit record to database...");
      const formattedPermitNumber = formatPermitNumberInput(formData.permitNumber);
      const finalPurposeValue = formData.purpose === 'OTHER' ? formData.customPurpose : formData.purpose;

      const metadataPayload = {
        permitNumber: formattedPermitNumber,
        dateIssued: formData.dateIssued,
        purpose: finalPurposeValue,
        applicantName: formData.applicantName,
        phone: formData.phone,
        location: formData.location,
        address: formData.address,
        certificateLink: certificateLink,
        drawingsLinks: drawingsLinks.join(','),
        permitFormLink: permitFormLink,
        receiptsLinks: receiptsLinks.join(',')
      };

      const metaRes = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/archive-metadata", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(metadataPayload)
      });

      const metaData = await metaRes.json();

      if (metaRes.ok && metaData.success) {
        setMessage("Success! Record and 100MB+ files uploaded directly to Google Drive.");
        setFormData({ permitNumber: '', dateIssued: '', purpose: 'RESIDENTIAL', customPurpose: '', applicantName: '', phone: '', address: '', location: '' });
        setFiles({ certificate: [], drawings: [], permitForm: [], receipts: [] });
        setDuplicateWarning('');
        setTimeout(() => setMessage(''), 4000);
      } else {
        setMessage(metaData.message || "Failed to save record metadata.");
      }

    } catch (err) {
      console.error("Direct Upload Error:", err);
      if (err.message !== "Session expired") {
        setMessage("Upload Error: " + (err.message || "Failed to complete upload."));
      }
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
                  className="text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded text-xs cursor-pointer"
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
        <button 
          onClick={handleLogout} 
          className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded border border-red-200 font-medium hover:bg-red-100 transition cursor-pointer"
        >
          Logout
        </button>
      </div>

      {duplicateWarning && (
        <div className="p-4 mb-6 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-medium shadow-sm text-sm">
          {duplicateWarning}
        </div>
      )}
      
      {message && (
        <div className={"p-4 mb-6 rounded-md font-medium transition-all shadow-sm " + (message.includes("Success") ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200")}> 
          {message} 
        </div>
      )}

      {isSubmitting && (
        <div className="mb-6 bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-2">
          <div className="flex justify-between text-xs font-bold text-blue-800">
            <span>Uploading Directly to Google Drive (Parallel Stream)...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div className="bg-blue-600 h-3 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-8 border border-gray-100">
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
                onBlur={handlePermitBlurOrDateChange}
                required 
                disabled={isSubmitting}
                className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm" 
                placeholder="E.G., LAK-NIN2630 or NIPDA/LAK-NIN/26/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Issued</label>
              <input 
                type="date" 
                name="dateIssued" 
                value={formData.dateIssued} 
                onChange={(e) => { handleTextChange(e); handlePermitBlurOrDateChange(); }} 
                required 
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-50 text-sm" 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Building Purpose / Use</label>
              <select 
                name="purpose" 
                value={formData.purpose} 
                onChange={handleTextChange} 
                required 
                disabled={isSubmitting}
                className="w-full p-2 border border-gray-300 rounded-md bg-white uppercase disabled:bg-gray-50 text-sm"
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
                  className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm" 
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
              <input 
                type="text" 
                name="applicantName" 
                value={formData.applicantName} 
                onChange={handleTextChange} 
                required 
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm" 
                placeholder="E.G., JOHN & MARY DOE / ST. PETER'S METHODIST CHURCH" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
              <input 
                type="text" 
                name="phone" 
                value={formData.phone} 
                onChange={handleTextChange} 
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-50 text-sm" 
                placeholder="Optional" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Community</label>
              <input 
                type="text" 
                name="location" 
                value={formData.location} 
                onChange={handleTextChange} 
                required 
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm" 
                placeholder="E.G., PRAMPRAM" 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address / Plot Description</label>
              <input 
                type="text" 
                name="address" 
                value={formData.address} 
                onChange={handleTextChange} 
                required 
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm" 
                placeholder="E.G., PLOT 12, BLOCK B" 
              />
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
            <span>Archiving Documents ({uploadProgress}%)...</span>
          ) : (
            <span>Save to Secure Archives</span>
          )}
        </button>
      </form>
    </div>
  );
};

export default NewPermit;