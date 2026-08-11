import React, { useState, useEffect, useRef } from 'react';
import Login from '../Login';

// Auto-Mask Handler: converts typed digits into DD/MM/YY automatically (e.g. 200126 -> 20/01/26)
const formatMaskedDate = (val) => {
  const digits = String(val).replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

// Converts DD/MM/YY or DD/MM/YYYY into clean ISO format YYYY-MM-DD for database storage
const parseFlexibleDate = (inputStr) => {
  if (!inputStr) return '';
  const str = String(inputStr).trim();

  // Excel serial fallback (e.g., 45658 -> 2026-01-20)
  if (/^\d{5}$/.test(str)) {
    const excelSerial = parseInt(str, 10);
    const utcDays = excelSerial - 25569;
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  const expandYear = (yy) => {
    if (yy.length === 4) return yy;
    const num = parseInt(yy, 10);
    if (isNaN(num)) return yy;
    return num <= 30 ? `20${yy.padStart(2, '0')}` : `19${yy.padStart(2, '0')}`;
  };

  // Matches ISO YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Matches DD/MM/YY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2}|\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const fullYear = expandYear(year);
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Continuous digits DDMMYY
  if (/^\d{6}$/.test(str)) {
    const day = str.substring(0, 2);
    const month = str.substring(2, 4);
    const year = expandYear(str.substring(4, 6));
    return `${year}-${month}-${day}`;
  }

  return str;
};

// Universal Column Matcher that handles BOM markers and subtle spaces
const getRowVal = (rowObj, possibleKeys) => {
  for (const rawKey of Object.keys(rowObj)) {
    const cleanKey = rawKey
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    if (possibleKeys.includes(cleanKey)) {
      const val = rowObj[rawKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }
  return '';
};

// Resilient CSV / TSV Parser
const parseCSVText = (text) => {
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r\n|\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  let delimiter = ',';
  if ((firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length) {
    delimiter = '\t';
  } else if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) {
    delimiter = ';';
  }

  const parseLine = (line) => {
    const values = [];
    let insideQuote = false;
    let currentValue = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === delimiter && !insideQuote) {
        values.push(currentValue.trim().replace(/^"|"$/g, ''));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim().replace(/^"|"$/g, ''));
    return values;
  };

  const rawHeaders = parseLine(lines[0]);

  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row = {};
    rawHeaders.forEach((h, idx) => {
      row[h] = vals[idx] || '';
    });
    return row;
  });
};

const NewPermit = () => {
  const [currentUser, setCurrentUser] = useState(null);

  const csvInputRef = useRef(null);
  const activeXhrsRef = useRef([]);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('token');
    if (savedUser && token) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Session parse error:", e);
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
    if (name === 'dateIssued') {
      setFormData(prev => ({ ...prev, dateIssued: formatMaskedDate(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleInputBlur = (e) => {
    const { name, value } = e.target;
    
    if (name === 'permitNumber') {
      const formatted = formatPermitNumberInput(value);
      setFormData(prev => ({ ...prev, permitNumber: formatted }));
      checkDuplicateRecord(formatted);
    } else if (name !== 'phone' && name !== 'dateIssued') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    }
  };

  // STRICT DUPLICATE CHECK BY PERMIT NUMBER ONLY
  const checkDuplicateRecord = async (permitNum) => {
    if (!permitNum || !permitNum.trim()) return;
    
    try {
      const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits");
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        const cleanInput = permitNum.toLowerCase().replace(/[^a-z0-9]/g, '');

        const duplicate = data.data.find(p => {
          const cleanDb = (p.permit_number || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanDb === cleanInput;
        });

        if (duplicate) {
          setDuplicateWarning(`⚠️ Duplicate Warning: A permit with number "${permitNum}" is already archived in the system.`);
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
    setMessage("⏹️ Upload process was canceled.");
  };

  // BULK CSV IMPORT HANDLER
  const handleBulkCsvUpload = async (e) => {
    e.stopPropagation();
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const parsedRows = parseCSVText(text);

        if (parsedRows.length === 0) {
          alert("CSV file is empty or formatted incorrectly.");
          return;
        }

        const records = parsedRows.map(obj => {
          const pNum = getRowVal(obj, ['permitnumber', 'permitnum', 'permitno', 'permit', 'fileref']);
          const appName = getRowVal(obj, ['applicantname', 'applicant', 'applicantownername', 'ownername', 'name']);
          const dateVal = getRowVal(obj, ['dateissued', 'dateissue', 'date', 'issueddate']);
          const purposeVal = getRowVal(obj, ['purpose', 'buildingpurpose', 'use']) || 'RESIDENTIAL';
          const locVal = getRowVal(obj, ['location', 'community', 'town']) || 'N/A';
          const addrVal = getRowVal(obj, ['address', 'siteaddress', 'plot']) || locVal;
          const phoneVal = getRowVal(obj, ['phone', 'contact', 'phonenumber', 'mobile']);

          return {
            permitNumber: pNum,
            applicantName: appName || 'N/A',
            dateIssued: parseFlexibleDate(dateVal) || new Date().toISOString().split('T')[0],
            purpose: purposeVal,
            location: locVal,
            address: addrVal,
            phone: phoneVal
          };
        }).filter(r => r.permitNumber);

        if (records.length === 0) {
          alert("No valid permit records found. Ensure your CSV header contains 'permit_number'.");
          return;
        }

        setIsSubmitting(true);
        setMessage(`Importing ${records.length} permit records...`);

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
          setMessage(`🎉 Import complete! Successfully added ${result.insertedCount || 0} record(s). Skipped ${result.skippedCount || 0} existing record(s).`);
        } else {
          setMessage("Bulk Import Error: Failed to import records. Please check the file and try again.");
        }
      } catch (err) {
        console.error("Bulk CSV Parse Error:", err);
        alert("Failed to parse CSV file. Ensure it is formatted correctly.");
      } finally {
        setIsSubmitting(false);
        if (csvInputRef.current) csvInputRef.current.value = '';
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

      setMessage("Initializing permit archive...");
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
        throw new Error("Unable to prepare document storage.");
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
          throw new Error("Upload session creation failed.");
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
              reject(new Error("Document upload failed."));
            }
          };

          xhr.onerror = () => reject(new Error("Network connection error."));
          xhr.onabort = () => reject(new Error("CANCELLED_BY_USER"));
          
          xhr.send(file);
        });
      };

      setMessage("Uploading attached documents...");

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

      setMessage("Finalizing record...");
      const finalPurposeValue = formData.purpose === 'OTHER' ? formData.customPurpose : formData.purpose;

      const metadataPayload = {
        permitNumber: formattedPermitNumber,
        dateIssued: parseFlexibleDate(formData.dateIssued) || formData.dateIssued,
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
        setMessage("Success! Permit Archived.");
        
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
          console.error("Failed to generate QR badge:", qrErr);
        }

        setFormData({ permitNumber: '', dateIssued: '', purpose: 'RESIDENTIAL', customPurpose: '', applicantName: '', phone: '', address: '', location: '' });
        setFiles({ certificate: [], drawings: [], permitForm: [] });
        setDuplicateWarning('');
      } else {
        setMessage(metaData.message || "Failed to save permit record.");
      }

    } catch (err) {
      if (err.message === "CANCELLED_BY_USER" || err.name === "AbortError") {
        console.log("Upload canceled by officer.");
      } else {
        console.error("Upload Error:", err);
        setMessage("Upload Error: " + (err.message || "Failed to complete process."));
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
          <h1 className="text-2xl font-bold text-gray-900">Archive Permit</h1>
          <p className="text-xs text-gray-500">Logged in as: <span className="font-semibold text-gray-700">{currentUser.name || currentUser.email}</span></p>
        </div>
        <button 
          onClick={handleLogout} 
          className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded border border-red-200 font-medium hover:bg-red-100 transition cursor-pointer"
        >
          Logout
        </button>
      </div>

      {/* BULK CSV IMPORT BOX */}
      <div className="mb-6 p-5 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-emerald-900">📊 Import Permit Records (CSV)</h3>
          <p className="text-xs text-emerald-700">Upload a CSV spreadsheet containing permit numbers, dates, applicants, and locations to import records.</p>
        </div>

        <button 
          type="button"
          onClick={() => csvInputRef.current && csvInputRef.current.click()}
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg transition shadow-sm whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          📂 Upload CSV Spreadsheet
        </button>
        <input 
          ref={csvInputRef}
          type="file" 
          accept=".csv" 
          onChange={handleBulkCsvUpload} 
          disabled={isSubmitting} 
          className="hidden" 
        />
      </div>

      {duplicateWarning && (
        <div className="p-4 mb-6 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-medium shadow-sm text-sm">
          {duplicateWarning}
        </div>
      )}
      
      {message && (
        <div className={"p-4 mb-6 rounded-md font-medium transition-all shadow-sm " + (message.includes("Success") || message.includes("complete") ? "bg-green-100 text-green-700 border border-green-200" : message.includes("canceled") ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-100 text-blue-700 border border-blue-200")}> 
          {message} 
        </div>
      )}

      {isSubmitting && (
        <div className="mb-6 bg-white p-5 rounded-xl border border-blue-200 shadow-md space-y-3">
          <div className="flex justify-between items-center text-xs font-bold text-blue-800">
            <span>Uploading Documents...</span>
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
              <span>⏹️ Cancel</span>
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
                <label className="block text-sm font-medium text-gray-700">Date Issued (DD/MM/YY)</label>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const dd = String(today.getDate()).padStart(2, '0');
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const yy = String(today.getFullYear()).slice(-2);
                    setFormData(prev => ({ ...prev, dateIssued: `${dd}/${mm}/${yy}` }));
                  }}
                  className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                >
                  📅 Set Today
                </button>
              </div>
              <input 
                type="text" 
                name="dateIssued" 
                value={formData.dateIssued} 
                onChange={handleTextChange} 
                onBlur={handleInputBlur}
                required 
                maxLength={8}
                disabled={isSubmitting} 
                className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono" 
                placeholder="DD/MM/YY"
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
            <span>Processing ({uploadProgress}%)...</span>
          ) : (
            <span>Save to Secure Archives</span>
          )}
        </button>
      </form>

      {/* PRINTABLE QR BADGE MODAL */}
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