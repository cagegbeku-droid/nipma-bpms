import React, { useState, useEffect, useRef } from 'react';
import Login from '../Login';

const parseFlexibleDate = (inputStr) => {
  if (!inputStr) return '';
  const str = inputStr.trim();

  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const d8Match = str.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (d8Match) {
    const [, day, month, year] = d8Match;
    return `${year}-${month}-${day}`;
  }

  return str;
};

const NewPermit = () => {
  const [currentUser, setCurrentUser] = useState(null);

  const activeXhrsRef = useRef([]);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('token');
    if (savedUser && token) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Error parsing user session:", e);
      }
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
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
  
  const [files, setFiles] = useState({ certificate: [], drawings: [], permitForm: [] });
  const [message, setMessage] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [qrCodeData, setQrCodeData] = useState({ isOpen: false, code: '', permitNum: '' });

  const formatPermitNumberInput = (value) => {
    const cleanVal = (value || '').trim().toUpperCase();
    if (!cleanVal) return '';
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInputBlur = (e) => {
    const { name, value } = e.target;
    
    if (name === 'permitNumber') {
      const formatted = formatPermitNumberInput(value);
      setFormData(prev => ({ ...prev, permitNumber: formatted }));
      checkDuplicateRecord(formatted, formData.dateIssued);
    } else if (name === 'dateIssued') {
      checkDuplicateRecord(formatPermitNumberInput(formData.permitNumber), value);
    } else if (name !== 'phone') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    }
  };

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

  const handleFileChange = (e) => {
    const fieldName = e.target.name;
    const newFiles = Array.from(e.target.files);
    if (!files[fieldName]) return; 
    setFiles(prev => ({ ...prev, [fieldName]: [...prev[fieldName], ...newFiles] }));
  };

  const removeFile = (fieldName, indexToRemove) => {
    setFiles(prev => ({ ...prev, [fieldName]: prev[fieldName].filter((_, index) => index !== indexToRemove) }));
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    activeXhrsRef.current.forEach(xhr => {
      if (xhr && xhr.readyState !== 4) {
        xhr.abort();
      }
    });
    activeXhrsRef.current = [];
    setIsSubmitting(false);
    setUploadProgress(0);
    setMessage("⏹️ Upload process was stopped by user.");
  };

  // --- BULK CSV IMPORT HANDLER ---
  const handleBulkCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
          alert("CSV file is empty or missing headers.");
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const records = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return {
            permitNumber: obj['permit_number'] || obj['permitnumber'] || obj['permit_num'] || obj['permit'],
            applicantName: obj['applicant_name'] || obj['applicantname'] || obj['applicant'] || obj['name'],
            dateIssued: obj['date_issued'] || obj['dateissued'] || obj['date'] || '2026-01-01',
            purpose: obj['purpose'] || 'RESIDENTIAL',
            location: obj['location'] || 'N/A',
            address: obj['address'] || 'N/A',
            phone: obj['phone'] || ''
          };
        }).filter(r => r.permitNumber);

        if (records.length === 0) {
          alert("No valid records found in CSV file.");
          return;
        }

        setIsSubmitting(true);
        setMessage(`Importing ${records.length} historical records into Supabase...`);

        const token = sessionStorage.getItem('token');
        const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/bulk-import", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ records })
        });

        const result = await response.json();
        if (response.ok && result.success) {
          setMessage(`🎉 ${result.message}`);
        } else {
          setMessage(`Bulk Import Error: ${result.message}`);
        }
      } catch (err) {
        console.error("Bulk CSV Parse Error:", err);
        alert("Failed to parse CSV file. Ensure it is formatted correctly.");
      } finally {
        setIsSubmitting(false);
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUploadProgress(0);
    activeXhrsRef.current = [];
    abortControllerRef.current = new AbortController();

    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        handleLogout();
        return;
      }

      const formattedPermitNumber = formatPermitNumberInput(formData.permitNumber);

      const activeCategories = [];
      if (files.certificate.length > 0) activeCategories.push('certificate');
      if (files.drawings.length > 0) activeCategories.push('drawings');
      if (files.permitForm.length > 0) activeCategories.push('permitForm');

      setMessage("Creating Google Drive permit folder...");
      const folderRes = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/create-permit-folders", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          permitNumber: formattedPermitNumber,
          applicantName: formData.applicantName.toUpperCase(),
          categories: activeCategories
        })
      });

      if (folderRes.status === 401 || folderRes.status === 403) {
        alert("Your session has expired. Please log in again.");
        handleLogout();
        return;
      }

      const folderData = await folderRes.json();
      if (!folderRes.ok || !folderData.success || !folderData.subfolders) {
        throw new Error(folderData.message || "Failed to create Google Drive permit folders.");
      }

      const subfolders = folderData.subfolders;

      const uploadFileDirectToDrive = async (file, targetFolderId) => {
        const sessionRes = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/get-drive-upload-url", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({ 
            targetFolderId: targetFolderId,
            fileName: file.name, 
            mimeType: file.type || 'application/pdf',
            fileSize: file.size
          })
        });

        const sessionData = await sessionRes.json();
        if (!sessionData.success || !sessionData.uploadUrl) {
          throw new Error(sessionData.message || "Failed to create Google Drive session.");
        }

        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          activeXhrsRef.current.push(xhr);

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
          xhr.onabort = () => reject(new Error("CANCELLED_BY_USER"));
          
          xhr.send(file);
        });
      };

      setMessage("Uploading documents to Google Drive subfolders...");

      const certPromise = (files.certificate.length > 0 && subfolders.certificate) 
        ? uploadFileDirectToDrive(files.certificate[0], subfolders.certificate) 
        : Promise.resolve('');

      const formPromise = (files.permitForm.length > 0 && subfolders.permitForm) 
        ? uploadFileDirectToDrive(files.permitForm[0], subfolders.permitForm) 
        : Promise.resolve('');

      const drawingsPromises = (files.drawings.length > 0 && subfolders.drawings) 
        ? files.drawings.map(file => uploadFileDirectToDrive(file, subfolders.drawings)) 
        : [];

      const [certificateLink, permitFormLink, drawingsLinks] = await Promise.all([
        certPromise,
        formPromise,
        Promise.all(drawingsPromises)
      ]);

      setMessage("Saving permit record metadata...");
      const finalPurposeValue = formData.purpose === 'OTHER' ? formData.customPurpose : formData.purpose;

      const metadataPayload = {
        permitNumber: formattedPermitNumber,
        dateIssued: formData.dateIssued,
        purpose: finalPurposeValue.toUpperCase(),
        applicantName: formData.applicantName.toUpperCase(),
        phone: formData.phone,
        location: formData.location.toUpperCase(),
        address: formData.address.toUpperCase(),
        certificateLink: certificateLink,
        drawingsLinks: drawingsLinks.join(','),
        permitFormLink: permitFormLink
      };

      const metaRes = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/archive-metadata", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify(metadataPayload)
      });

      const metaData = await metaRes.json();

      if (metaRes.ok && metaData.success) {
        setMessage("Success! Permit archived cleanly.");
        
        try {
          const qrRes = await fetch(`https://nipma-bpms-backend.onrender.com/api/permits/qr/${encodeURIComponent(formattedPermitNumber)}`);
          const qrJson = await qrRes.json();
          if (qrJson.success && qrJson.qrCode) {
            setQrCodeData({
              isOpen: true,
              code: qrJson.qrCode,
              permitNum: formattedPermitNumber
            });
          }
        } catch (qrErr) {
          console.error("Failed to load QR badge:", qrErr);
        }

        setFormData({ permitNumber: '', dateIssued: '', purpose: 'RESIDENTIAL', customPurpose: '', applicantName: '', phone: '', address: '', location: '' });
        setFiles({ certificate: [], drawings: [], permitForm: [] });
        setDuplicateWarning('');
      } else {
        setMessage(metaData.message || "Failed to save record metadata.");
      }

    } catch (err) {
      if (err.message === "CANCELLED_BY_USER" || err.name === "AbortError") {
        console.log("Upload aborted by officer.");
      } else {
        console.error("Direct Upload Error:", err);
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
                  className="text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded text-xs cursor-pointer disabled:opacity-50"
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

  const roleStr = (currentUser?.role || '').toLowerCase();
  const isAuthorized = currentUser && (
    !currentUser.role || 
    roleStr === 'uploader' || 
    roleStr === 'admin' || 
    roleStr === 'officer' || 
    roleStr === 'staff'
  );

  if (!currentUser || !isAuthorized) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archive Historical Permit</h1>
          <p className="text-xs text-gray-500">Logged in as: <span className="font-semibold text-gray-700">{currentUser.name || currentUser.email}</span></p>
        </div>
        <button 
          onClick={handleLogout} 
          className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded border border-red-200 font-medium hover:bg-red-100 transition cursor-pointer"
        >
          Logout
        </button>
      </div>

      {/* --- BULK CSV IMPORT BOX --- */}
      <div className="mb-6 p-5 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-emerald-900">📊 Bulk Import Historical Permits (CSV Spreadsheet)</h3>
          <p className="text-xs text-emerald-700">Upload a `.csv` file containing permit numbers, dates, applicants, and locations to import hundreds of records instantly.</p>
        </div>

        <label className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg cursor-pointer transition shadow-sm whitespace-nowrap">
          <span>📂 Upload CSV Spreadsheet</span>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleBulkCsvUpload} 
            disabled={isSubmitting} 
            className="hidden" 
          />
        </label>
      </div>

      {duplicateWarning && (
        <div className="p-4 mb-6 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-medium shadow-sm text-sm">
          {duplicateWarning}
        </div>
      )}
      
      {message && (
        <div className={"p-4 mb-6 rounded-md font-medium transition-all shadow-sm " + (message.includes("Success") || message.includes("Import complete") ? "bg-green-100 text-green-700 border border-green-200" : message.includes("stopped") ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-100 text-blue-700 border border-blue-200")}> 
          {message} 
        </div>
      )}

      {isSubmitting && (
        <div className="mb-6 bg-white p-5 rounded-xl border border-blue-200 shadow-md space-y-3">
          <div className="flex justify-between items-center text-xs font-bold text-blue-800">
            <span>Creating Folders & Transferring Files to Archives...</span>
            <span className="text-sm text-blue-900">{uploadProgress}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div className="bg-blue-600 h-3 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
          </div>

          <div className="flex justify-end pt-1">
            <button 
              type="button" 
              onClick={handleCancelUpload}
              className="bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs px-4 py-2 rounded-lg transition border border-red-300 cursor-pointer flex items-center space-x-1"
            >
              <span>⏹️ Cancel Upload</span>
            </button>
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
                onBlur={handleInputBlur}
                required 
                disabled={isSubmitting}
                className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                placeholder="E.G., LAK-NIN2630 or NIPDA/LAK-NIN/26/30"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Date Issued</label>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setFormData(prev => ({ ...prev, dateIssued: today }));
                    checkDuplicateRecord(formData.permitNumber, today);
                  }}
                  className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                >
                  📅 Set Today
                </button>
              </div>
              <input 
                type="date" 
                name="dateIssued" 
                value={formData.dateIssued} 
                onChange={handleTextChange} 
                onBlur={(e) => {
                  const parsedDate = parseFlexibleDate(e.target.value);
                  setFormData(prev => ({ ...prev, dateIssued: parsedDate }));
                  handleInputBlur(e);
                }}
                required 
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
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
                className="w-full p-2 border border-gray-300 rounded-md bg-white uppercase disabled:bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  onBlur={handleInputBlur}
                  required 
                  disabled={isSubmitting}
                  className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
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
                onBlur={handleInputBlur}
                required 
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
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
                className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
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
                onBlur={handleInputBlur}
                required 
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
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
                onBlur={handleInputBlur}
                required 
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md uppercase disabled:bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                placeholder="E.G., PLOT 12, BLOCK B" 
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">3. Document Vault</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-6 rounded-lg border border-gray-200">
            {renderDocumentUpload("Permit Certificate", "certificate", false)}
            {renderDocumentUpload("Architectural Drawings", "drawings", true)}
            {renderDocumentUpload("Permit Form", "permitForm", true)}
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

      {/* --- PRINTABLE QR BADGE MODAL --- */}
      {qrCodeData.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center relative animate-fadeIn">
            <button 
              onClick={() => setQrCodeData({ isOpen: false, code: '', permitNum: '' })}
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 font-bold text-xl cursor-pointer"
            >
              &times;
            </button>

            <h3 className="font-bold text-sm uppercase text-gray-800">NINGO PRAMPRAM Municipal Assembly</h3>
            <p className="text-xs text-gray-500 mb-3">Official Verification Sticker</p>

            <div className="flex justify-center my-3 border p-2 rounded bg-white">
              <img src={qrCodeData.code} alt="Permit QR Code" className="w-48 h-48" />
            </div>

            <p className="font-mono font-bold text-blue-900 text-sm">{qrCodeData.permitNum}</p>

            <button 
              onClick={() => window.print()} 
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm transition cursor-pointer"
            >
              🖨️ Print Badge Sticker
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default NewPermit;