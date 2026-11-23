import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Login from '../Login';
import CircularProgress from '../components/CircularProgress';
import DocumentViewerModal from '../components/DocumentViewerModal';
import { API_BASE_URL } from '../config/api';

// Segmented Date Input Sub-Component with pre-rendered slashes and auto-focusing segments
const SegmentedDateInput = ({ value, onChange, onBlur, disabled }) => {
  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  // Sync internal input fields whenever parent value changes (e.g. Set Today or Form Reset)
  useEffect(() => {
    if (!value) {
      setDay('');
      setMonth('');
      setYear('');
      return;
    }
    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        setDay(parts[0]);
        setMonth(parts[1]);
        setYear(parts[2]);
      }
    } else if (value.includes('-')) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setYear(parts[0].length === 4 ? parts[0].slice(-2) : parts[0]);
        setMonth(parts[1]);
        setDay(parts[2]);
      }
    }
  }, [value]);

  const updateParent = (d, m, y) => {
    setDay(d);
    setMonth(m);
    setYear(y);
    if (d || m || y) {
      onChange(`${d}/${m}/${y}`);
    } else {
      onChange('');
    }
  };

  const handleDayChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    updateParent(val, month, year);
    if (val.length === 2 && monthRef.current) {
      monthRef.current.focus();
    }
  };

  const handleMonthChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    updateParent(day, val, year);
    if (val.length === 2 && yearRef.current) {
      yearRef.current.focus();
    }
  };

  const handleYearChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    updateParent(day, month, val);
  };

  const handleKeyDown = (e, segment) => {
    if (e.key === 'Backspace') {
      if (segment === 'month' && !month && dayRef.current) {
        dayRef.current.focus();
      } else if (segment === 'year' && !year && monthRef.current) {
        monthRef.current.focus();
      }
    }
  };

  return (
    <div className={`flex items-center border border-gray-300 rounded-md p-2 bg-white focus-within:ring-2 focus-within:ring-blue-500 font-mono text-sm ${disabled ? 'bg-gray-50 opacity-60 pointer-events-none' : ''}`}>
      <input
        ref={dayRef}
        type="text"
        placeholder="DD"
        maxLength={2}
        value={day}
        onChange={handleDayChange}
        onBlur={onBlur}
        disabled={disabled}
        className="w-7 text-center outline-none bg-transparent font-semibold text-gray-800 placeholder-gray-300"
      />
      <span className="text-gray-400 font-bold px-1 select-none">/</span>
      <input
        ref={monthRef}
        type="text"
        placeholder="MM"
        maxLength={2}
        value={month}
        onChange={handleMonthChange}
        onKeyDown={(e) => handleKeyDown(e, 'month')}
        onBlur={onBlur}
        disabled={disabled}
        className="w-7 text-center outline-none bg-transparent font-semibold text-gray-800 placeholder-gray-300"
      />
      <span className="text-gray-400 font-bold px-1 select-none">/</span>
      <input
        ref={yearRef}
        type="text"
        placeholder="YY"
        maxLength={4}
        value={year}
        onChange={handleYearChange}
        onKeyDown={(e) => handleKeyDown(e, 'year')}
        onBlur={onBlur}
        disabled={disabled}
        className="w-10 text-center outline-none bg-transparent font-semibold text-gray-800 placeholder-gray-300"
      />
    </div>
  );
};

// Flexible Date Parser (Converts DD/MM/YY, DD/MM/YYYY, DDMMYY, DDMMYYYY, or Excel Serials -> YYYY-MM-DD)
const parseFlexibleDate = (inputStr) => {
  if (!inputStr) return '';
  const str = String(inputStr).trim();

  // Excel serial number fallback (e.g. 45658 -> 2026-01-20)
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

  // Matches YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Matches DD/MM/YY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2}|\d{4})$/);
  if (dmyMatch) {
    const [, day, month, rawYear] = dmyMatch;
    const year = expandYear(rawYear);
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Matches continuous 6 digits: DDMMYY
  if (/^\d{6}$/.test(str)) {
    const day = str.substring(0, 2);
    const month = str.substring(2, 4);
    const year = expandYear(str.substring(4, 6));
    return `${year}-${month}-${day}`;
  }

  // Matches continuous 8 digits: DDMMYYYY
  if (/^\d{8}$/.test(str)) {
    const day = str.substring(0, 2);
    const month = str.substring(2, 4);
    const year = str.substring(4, 8);
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
    const savedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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
  const [duplicateRecord, setDuplicateRecord] = useState(null);
  const [selectedDuplicateModal, setSelectedDuplicateModal] = useState(false);
  const [viewerDoc, setViewerDoc] = useState({ isOpen: false, url: '', title: '' });
  const [attachingToExisting, setAttachingToExisting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdPermitNumber, setCreatedPermitNumber] = useState('');

  const [qrCodeData, setQrCodeData] = useState({ isOpen: false, code: '', permitNum: '' });

  // Sync cache helper so dashboard & registry numbers update automatically
  const syncDashboardCache = async () => {
    try {
      localStorage.removeItem('bpms_cached_dashboard');
      localStorage.removeItem('bpms_cached_permits');
      const res = await fetch(`${API_BASE_URL}/api/permits/stats`);
      const s = await res.json();
      if (s.success) {
        localStorage.setItem('bpms_cached_dashboard', JSON.stringify({
          total: s.total,
          recent: [],
          residential: s.residential,
          commercial: s.commercial,
          zones: s.zones,
          fullyDocumented: s.fullyDocumented,
          missingDocs: s.missingDocs,
          totalAttachedFiles: s.totalAttachedFiles,
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      console.warn("Failed to sync cache:", e);
    }
  };

  const parseDocLinks = (val) => {
    if (!val || val === 'null' || val === 'undefined') return [];
    return val.split(',').map(l => l.trim()).filter(l => l && l !== 'null' && l !== 'undefined');
  };

  const handleOpenDocViewer = (url, title) => {
    if (!url) return;
    setViewerDoc({ isOpen: true, url, title });
  };

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

  // REAL-TIME DUPLICATE CHECK: A permit is classified as duplicate ONLY when
  // Permit Number, Applicant Name, AND Date Issued are ALL identical.
  const checkDuplicateRecord = async (permitNum, appName, dateVal) => {
    const pNumber = (permitNum || '').trim();
    const applicant = (appName || '').trim();
    const dateStr = (dateVal || '').trim();

    // Only classify as duplicate when all three fields have been provided
    if (!pNumber || !applicant || !dateStr) {
      setDuplicateWarning('');
      setDuplicateRecord(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/permits`);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        const cleanInputNumber = pNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanInputName = applicant.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanInputDate = parseFlexibleDate(dateStr);

        const duplicate = data.data.find(p => {
          const dbNumber = (p.permit_number || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const dbName = (p.applicant_name || `${p.first_name || ''} ${p.last_name || ''}` || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const dbDate = parseFlexibleDate(p.date_issued || '');

          return (
            dbNumber === cleanInputNumber &&
            dbName === cleanInputName &&
            dbDate === cleanInputDate
          );
        });

        if (duplicate) {
          setDuplicateRecord(duplicate);
          setDuplicateWarning(`⚠️ Duplicate Warning: A permit with Number "${pNumber}", Applicant "${applicant}", and Date Issued "${dateStr}" is already archived in the registry.`);
        } else {
          setDuplicateRecord(null);
          setDuplicateWarning('');
        }
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
    }
  };

  // Debounced check whenever permitNumber, applicantName, or dateIssued changes
  useEffect(() => {
    if (formData.permitNumber && formData.applicantName && formData.dateIssued) {
      const timer = setTimeout(() => {
        checkDuplicateRecord(formData.permitNumber, formData.applicantName, formData.dateIssued);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setDuplicateWarning('');
      setDuplicateRecord(null);
    }
  }, [formData.permitNumber, formData.applicantName, formData.dateIssued]);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInputBlur = (e) => {
    const { name, value } = e.target;
    let updated = { ...formData };
    
    if (name === 'permitNumber') {
      const formatted = formatPermitNumberInput(value);
      updated.permitNumber = formatted;
      setFormData(prev => ({ ...prev, permitNumber: formatted }));
    } else if (name !== 'phone' && name !== 'dateIssued') {
      const upperVal = value.toUpperCase();
      updated[name] = upperVal;
      setFormData(prev => ({ ...prev, [name]: upperVal }));
    } else {
      updated[name] = value;
    }

    if (['permitNumber', 'applicantName', 'dateIssued'].includes(name)) {
      checkDuplicateRecord(updated.permitNumber, updated.applicantName, updated.dateIssued);
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

        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/permits/bulk-import`, {
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
          syncDashboardCache();
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

  // ARCHIVE PERMIT WITH GUARANTEED DOCUMENT UPLOADS
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setCreatedPermitNumber('');

    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (!token) {
        handleLogout();
        return;
      }

      if (duplicateWarning) {
        setMessage(duplicateWarning);
        setIsSubmitting(false);
        return;
      }

      const formattedPermitNumber = formatPermitNumberInput(formData.permitNumber);
      const finalPurpose = formData.purpose === 'OTHER' ? formData.customPurpose : formData.purpose;
      const parsedDate = parseFlexibleDate(formData.dateIssued) || formData.dateIssued;

      const hasFiles = files.certificate.length > 0 || files.drawings.length > 0 || files.permitForm.length > 0;

      // STEP 1: ARCHIVE PERMIT & UPLOAD ATTACHED DOCUMENTS
      setMessage(hasFiles ? "Archiving permit record & uploading documents directly to Google Drive..." : "Saving permit record...");

      const formDataToSend = new FormData();
      formDataToSend.append('permitNumber', formattedPermitNumber);
      formDataToSend.append('dateIssued', parsedDate);
      formDataToSend.append('purpose', finalPurpose.toUpperCase());
      formDataToSend.append('applicantName', formData.applicantName.toUpperCase());
      if (formData.phone) formDataToSend.append('phone', formData.phone);
      formDataToSend.append('location', formData.location.toUpperCase());
      formDataToSend.append('address', formData.address.toUpperCase());

      if (files.certificate.length > 0) {
        formDataToSend.append('certificate', files.certificate[0]);
      }
      files.drawings.forEach(f => formDataToSend.append('drawings', f));
      files.permitForm.forEach(f => formDataToSend.append('permitForm', f));

      setUploadProgress(10);

      const archiveData = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE_URL}/api/permits/archive`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.min(Math.round((e.loaded / e.total) * 95), 95);
            setUploadProgress(Math.max(pct, 12));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resData = JSON.parse(xhr.responseText);
              setUploadProgress(100);
              resolve(resData);
            } catch (err) {
              reject(new Error("Invalid response from server."));
            }
          } else {
            try {
              const errData = JSON.parse(xhr.responseText);
              if (xhr.status === 409 && errData.existingPermit) {
                setDuplicateRecord(errData.existingPermit);
                setDuplicateWarning(errData.message || 'Duplicate permit found.');
              }
              reject(new Error(errData.message || `Failed to archive permit record (Status ${xhr.status}).`));
            } catch {
              reject(new Error(`Failed to archive permit record (Status ${xhr.status}).`));
            }
          }
        };

        xhr.onerror = () => reject(new Error("Network connection error during archive."));
        xhr.send(formDataToSend);
      });

      if (!archiveData || !archiveData.success) {
        throw new Error(archiveData?.message || "Failed to archive permit record.");
      }

      // Automatically sync dashboard & registry cache
      syncDashboardCache();

      // STEP 3: GENERATE QR BADGE
      try {
        const qrRes = await fetch(`${API_BASE_URL}/api/permits/qr/${encodeURIComponent(formattedPermitNumber)}`);
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

      // STEP 4: RESET FORM AND CONFIRM SUCCESS
      setCreatedPermitNumber(formattedPermitNumber);
      setMessage(hasFiles ? "Success! Permit and all documents archived successfully." : "Success! Permit record archived.");
      setFormData({ permitNumber: '', dateIssued: '', purpose: 'RESIDENTIAL', customPurpose: '', applicantName: '', phone: '', address: '', location: '' });
      setFiles({ certificate: [], drawings: [], permitForm: [] });
      setDuplicateWarning('');
      setDuplicateRecord(null);

    } catch (err) {
      console.error("Submit Error:", err);
      setMessage("Error saving record: " + err.message);
    } finally {
      setTimeout(() => {
        setIsSubmitting(false);
        setUploadProgress(0);
      }, 600);
    }
  };

  const handleDirectUploadToExisting = async (category, fileList) => {
    if (!duplicateRecord || !fileList || fileList.length === 0) return;
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) {
      alert("Officer login session required.");
      return;
    }

    const filesArray = Array.from(fileList);
    setAttachingToExisting(true);

    try {
      const formDataToSend = new FormData();
      if (category === 'certificate') {
        formDataToSend.append('certificate', filesArray[0]);
      } else if (category === 'drawings') {
        filesArray.forEach(f => formDataToSend.append('drawings', f));
      } else if (category === 'permitForm') {
        filesArray.forEach(f => formDataToSend.append('permitForm', f));
      }

      const res = await fetch(`${API_BASE_URL}/api/permits/${duplicateRecord.id}/upload-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to attach document to existing permit.");
      }

      const updatedCert = resData.permit?.certificate_link || resData.certificate_link || (category === 'certificate' ? resData.new_links : undefined);
      const updatedDrawings = resData.permit?.drawings_links || resData.drawings_links || (category === 'drawings' ? resData.new_links : undefined);
      const updatedForm = resData.permit?.permit_form_link || resData.permit_form_link || (category === 'permitForm' ? resData.new_links : undefined);

      setDuplicateRecord(prev => ({
        ...prev,
        ...(updatedCert !== undefined ? { certificate_link: updatedCert } : {}),
        ...(updatedDrawings !== undefined ? { drawings_links: updatedDrawings } : {}),
        ...(updatedForm !== undefined ? { permit_form_link: updatedForm } : {})
      }));

      syncDashboardCache();
      alert(`✅ Successfully attached document(s) to existing permit ${duplicateRecord.permit_number}!`);
    } catch (err) {
      console.error("Direct upload to existing error:", err);
      alert("Attachment error: " + err.message);
    } finally {
      setAttachingToExisting(false);
    }
  };

  const renderDocumentUpload = (label, fieldName, allowMultiple = true) => {
    const currentFiles = files[fieldName] || []; 
    return (
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-2">
        <label className="block text-sm font-bold text-gray-800">{label}</label>
        
        <label className={`cursor-pointer bg-blue-50 text-blue-700 font-semibold py-2.5 px-4 rounded-md hover:bg-blue-100 transition text-sm flex items-center justify-center border border-blue-200 ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}>
          <span>📁 Select {allowMultiple ? 'Files' : 'File'}</span>
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
      <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-emerald-900">📊 Import Records (CSV)</h3>
        </div>

        <button 
          type="button"
          onClick={() => csvInputRef.current && csvInputRef.current.click()}
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-lg transition shadow-xs whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          Upload CSV
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
        <div className={"p-4 mb-6 rounded-md font-medium transition-all shadow-sm flex items-center justify-between flex-wrap gap-3 " + (message.includes("Success") || message.includes("complete") ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200")}> 
          <span>{message}</span>
          {createdPermitNumber && (
            <Link 
              to={`/permits/historical?view=${encodeURIComponent(createdPermitNumber)}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-green-700 hover:bg-green-800 text-white px-3.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <span>👁️ View in Registry</span>
              <span>→</span>
            </Link>
          )}
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
              <SegmentedDateInput 
                value={formData.dateIssued}
                onChange={(val) => setFormData(prev => ({ ...prev, dateIssued: val }))}
                onBlur={handleInputBlur}
                disabled={isSubmitting}
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

        {/* OFFICER QUALITY ASSURANCE & DUPLICATE RECORD CARD */}
        {duplicateRecord && (
          <div className="bg-amber-50/90 border-2 border-amber-300 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">⚠️</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-amber-900 text-base">Duplicate Record Found in Official Registry</h3>
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                      Existing Permit
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1">
                    Permit <span className="font-mono font-bold text-gray-900">{duplicateRecord.permit_number}</span> issued to <span className="font-bold text-gray-900">{duplicateRecord.applicant_name}</span> on <span className="font-mono font-bold text-gray-900">{duplicateRecord.date_issued}</span> is already archived.
                  </p>
                </div>
              </div>
            </div>

            {/* Existing Documents Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-amber-200/80 text-xs">
              <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-700 block">📜 Certificate:</span>
                  <span className={duplicateRecord.certificate_link && duplicateRecord.certificate_link !== 'null' ? "text-emerald-700 font-semibold" : "text-gray-400 italic"}>
                    {duplicateRecord.certificate_link && duplicateRecord.certificate_link !== 'null' ? "✅ Uploaded" : "❌ Missing"}
                  </span>
                </div>
                {duplicateRecord.certificate_link && duplicateRecord.certificate_link !== 'null' && (
                  <button
                    type="button"
                    onClick={() => handleOpenDocViewer(parseDocLinks(duplicateRecord.certificate_link)[0], `Certificate - ${duplicateRecord.permit_number}`)}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-bold cursor-pointer"
                  >
                    Preview
                  </button>
                )}
              </div>

              <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-700 block">📐 Drawings:</span>
                  <span className={duplicateRecord.drawings_links && duplicateRecord.drawings_links !== 'null' ? "text-emerald-700 font-semibold" : "text-gray-400 italic"}>
                    {duplicateRecord.drawings_links && duplicateRecord.drawings_links !== 'null' 
                      ? `✅ ${parseDocLinks(duplicateRecord.drawings_links).length} file(s)` 
                      : "❌ Missing"}
                  </span>
                </div>
                {duplicateRecord.drawings_links && duplicateRecord.drawings_links !== 'null' && (
                  <button
                    type="button"
                    onClick={() => handleOpenDocViewer(parseDocLinks(duplicateRecord.drawings_links)[0], `Drawings - ${duplicateRecord.permit_number}`)}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-bold cursor-pointer"
                  >
                    Preview
                  </button>
                )}
              </div>

              <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-700 block">📝 Permit Form:</span>
                  <span className={duplicateRecord.permit_form_link && duplicateRecord.permit_form_link !== 'null' ? "text-emerald-700 font-semibold" : "text-gray-400 italic"}>
                    {duplicateRecord.permit_form_link && duplicateRecord.permit_form_link !== 'null' 
                      ? `✅ ${parseDocLinks(duplicateRecord.permit_form_link).length} file(s)` 
                      : "❌ Missing"}
                  </span>
                </div>
                {duplicateRecord.permit_form_link && duplicateRecord.permit_form_link !== 'null' && (
                  <button
                    type="button"
                    onClick={() => handleOpenDocViewer(parseDocLinks(duplicateRecord.permit_form_link)[0], `Permit Form - ${duplicateRecord.permit_number}`)}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-bold cursor-pointer"
                  >
                    Preview
                  </button>
                )}
              </div>
            </div>

            {/* Actions for Officer */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDuplicateModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <span>👁️ View Existing Permit & All Documents</span>
              </button>
              <Link
                to={`/permits/historical?search=${encodeURIComponent(duplicateRecord.permit_number)}&view=${encodeURIComponent(duplicateRecord.permit_number)}`}
                target="_blank"
                className="inline-flex items-center gap-1 px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-amber-300 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <span>🔗 Open in Registry</span>
                <span className="text-[10px]">↗</span>
              </Link>
            </div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting || Boolean(duplicateRecord)}
          className="w-full bg-blue-600 text-white font-semibold py-4 rounded-md hover:bg-blue-700 transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-70 cursor-pointer"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2.5">
              <CircularProgress 
                progress={uploadProgress || 10} 
                size={22} 
                strokeWidth={2.5} 
                color="#ffffff" 
                bgColor="rgba(255,255,255,0.3)" 
                textColor="#ffffff" 
              />
              <span>
                {files.certificate.length > 0 || files.drawings.length > 0 || files.permitForm.length > 0 
                  ? (uploadProgress >= 95 ? 'Finalizing on Google Drive...' : `Archiving & Uploading (${uploadProgress || 10}%)...`) 
                  : 'Saving Permit Record...'}
              </span>
            </span>
          ) : (
            <span>Save Permit Record</span>
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

      {/* EXISTING DUPLICATE PERMIT & DOCUMENTS MODAL */}
      {selectedDuplicateModal && duplicateRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-fadeIn">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900">Existing Archived Permit</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    Existing Record
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Permit Number: <span className="font-semibold text-blue-900 font-mono">{duplicateRecord.permit_number}</span></p>
              </div>
              <button 
                onClick={() => setSelectedDuplicateModal(false)} 
                className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 uppercase font-semibold block">Applicant</span>
                  <span className="font-bold text-gray-900">{duplicateRecord.applicant_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold block">Date Issued</span>
                  <span className="font-bold text-gray-900">{duplicateRecord.date_issued}</span>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold block">Purpose</span>
                  <span className="font-bold text-gray-900">{duplicateRecord.purpose || 'RESIDENTIAL'}</span>
                </div>
                <div>
                  <span className="text-gray-500 uppercase font-semibold block">Location</span>
                  <span className="font-bold text-gray-900">{duplicateRecord.location || 'N/A'}</span>
                </div>
              </div>

              {/* Attached Documents Sections */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2">
                  Archived Documents on Google Drive
                </h4>

                {/* 1. Certificate */}
                <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 uppercase">1. Permit Certificate</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${duplicateRecord.certificate_link && duplicateRecord.certificate_link !== 'null' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                      {duplicateRecord.certificate_link && duplicateRecord.certificate_link !== 'null' ? 'Attached' : 'Missing'}
                    </span>
                  </div>
                  {duplicateRecord.certificate_link && duplicateRecord.certificate_link !== 'null' ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={parseDocLinks(duplicateRecord.certificate_link)[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        📄 Open in Drive ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => handleOpenDocViewer(parseDocLinks(duplicateRecord.certificate_link)[0], `Certificate - ${duplicateRecord.permit_number}`)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium cursor-pointer"
                      >
                        👁️ Preview
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      <label className="cursor-pointer px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold border border-blue-200">
                        <span>+ Attach Certificate</span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          disabled={attachingToExisting}
                          onChange={(e) => handleDirectUploadToExisting('certificate', e.target.files)}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* 2. Architectural Drawings */}
                <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 uppercase">2. Architectural Drawings</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${duplicateRecord.drawings_links && duplicateRecord.drawings_links !== 'null' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                      {duplicateRecord.drawings_links && duplicateRecord.drawings_links !== 'null' ? `${parseDocLinks(duplicateRecord.drawings_links).length} File(s)` : 'Missing'}
                    </span>
                  </div>
                  {duplicateRecord.drawings_links && duplicateRecord.drawings_links !== 'null' ? (
                    <div className="flex flex-wrap gap-2">
                      {parseDocLinks(duplicateRecord.drawings_links).map((link, idx) => (
                        <div key={idx} className="inline-flex items-center rounded-lg border border-blue-200 overflow-hidden text-xs">
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-2.5 py-1"
                          >
                            Part {idx + 1} ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => handleOpenDocViewer(link, `Drawing Part ${idx + 1} - ${duplicateRecord.permit_number}`)}
                            className="bg-white hover:bg-gray-50 text-gray-600 px-2 py-1 border-l border-blue-200 cursor-pointer"
                          >
                            👁️
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="pt-1">
                    <label className="cursor-pointer inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold border border-blue-200">
                      <span>+ {duplicateRecord.drawings_links ? 'Add More Drawings' : 'Attach Architectural Drawings'}</span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,image/*"
                        className="hidden"
                        disabled={attachingToExisting}
                        onChange={(e) => handleDirectUploadToExisting('drawings', e.target.files)}
                      />
                    </label>
                  </div>
                </div>

                {/* 3. Permit Form */}
                <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 uppercase">3. Permit Form</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${duplicateRecord.permit_form_link && duplicateRecord.permit_form_link !== 'null' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                      {duplicateRecord.permit_form_link && duplicateRecord.permit_form_link !== 'null' ? `${parseDocLinks(duplicateRecord.permit_form_link).length} File(s)` : 'Missing'}
                    </span>
                  </div>
                  {duplicateRecord.permit_form_link && duplicateRecord.permit_form_link !== 'null' ? (
                    <div className="flex flex-wrap gap-2">
                      {parseDocLinks(duplicateRecord.permit_form_link).map((link, idx) => (
                        <div key={idx} className="inline-flex items-center rounded-lg border border-blue-200 overflow-hidden text-xs">
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-2.5 py-1"
                          >
                            Part {idx + 1} ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => handleOpenDocViewer(link, `Permit Form Part ${idx + 1} - ${duplicateRecord.permit_number}`)}
                            className="bg-white hover:bg-gray-50 text-gray-600 px-2 py-1 border-l border-blue-200 cursor-pointer"
                          >
                            👁️
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="pt-1">
                    <label className="cursor-pointer inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold border border-blue-200">
                      <span>+ {duplicateRecord.permit_form_link ? 'Add More Forms' : 'Attach Permit Form'}</span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,image/*"
                        className="hidden"
                        disabled={attachingToExisting}
                        onChange={(e) => handleDirectUploadToExisting('permitForm', e.target.files)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <Link
                to={`/permits/historical?search=${encodeURIComponent(duplicateRecord.permit_number)}&view=${encodeURIComponent(duplicateRecord.permit_number)}`}
                target="_blank"
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>Open in Historical Registry ↗</span>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedDuplicateModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      <DocumentViewerModal
        isOpen={viewerDoc.isOpen}
        onClose={() => setViewerDoc({ isOpen: false, url: '', title: '' })}
        documentUrl={viewerDoc.url}
        title={viewerDoc.title}
      />

    </div>
  );
};

export default NewPermit;