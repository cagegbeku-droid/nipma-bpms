import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const VerifyPermit = () => {
  const [searchParams] = useSearchParams();
  const rawPermitNum = searchParams.get('id') || searchParams.get('permitNumber');

  const [permit, setPermit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Verifying permit record...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!rawPermitNum) {
      setError('No permit number provided in verification URL.');
      setLoading(false);
      return;
    }

    const verifyRecord = async () => {
      const cleanPermitNum = decodeURIComponent(rawPermitNum).trim();
      const encodedNum = encodeURIComponent(cleanPermitNum);
      const BACKEND_URL = 'https://nipma-bpms-backend.onrender.com/api/permits';

      const fetchWithRetry = async (url, retries = 2) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            if (attempt > 0) {
              setLoadingMessage('Connecting to registry...');
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const res = await fetch(url, {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (res.ok) {
              return await res.json();
            }
          } catch (err) {
            console.warn(`Attempt ${attempt + 1} failed:`, err.message);
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        throw new Error('Registry unreachable');
      };

      try {
        setLoadingMessage('Verifying permit record...');

        let data;
        try {
          data = await fetchWithRetry(`${BACKEND_URL}/verify-record?permitNumber=${encodedNum}`);
        } catch (e) {
          data = await fetchWithRetry(`${BACKEND_URL}/verify/${encodedNum}`);
        }

        if (data && data.success && data.data) {
          setPermit(data.data);
        } else {
          setError((data && data.message) || `Permit "${cleanPermitNum}" not found in official archives.`);
        }

      } catch (err) {
        console.error('Verification Fetch Error:', err);
        setError('Unable to connect to verification registry. Please check your network connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    verifyRecord();
  }, [rawPermitNum]);

  // Helper to ensure non-empty display string
  const getDisplayVal = (val1, val2) => {
    const val = val1 || val2;
    if (val && String(val).trim() !== '' && String(val).trim().toUpperCase() !== 'UNDEFINED') {
      return String(val).trim();
    }
    return 'N/A';
  };

  const permitNumber = getDisplayVal(permit?.permit_number, permit?.permitNumber);
  const applicantName = getDisplayVal(permit?.applicant_name, permit?.applicantName);
  const dateIssued = getDisplayVal(permit?.date_issued, permit?.dateIssued);
  const purpose = getDisplayVal(permit?.purpose);
  const location = getDisplayVal(permit?.location);
  const address = getDisplayVal(permit?.address);

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      
      {/* PRINT-ONLY OFFICIAL STYLES */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-slip {
            display: block !important;
            background: white !important;
            color: #0f172a !important;
            padding: 20px !important;
            border: 2px solid #0f172a !important;
            border-radius: 12px !important;
            width: 100% !important;
            max-width: 650px !important;
            margin: 0 auto !important;
          }
          .print-slip * {
            color: #0f172a !important;
          }
          .print-badge {
            border: 2px solid #059669 !important;
            background: #ecfdf5 !important;
            color: #047857 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* VERIFICATION CARD CONTAINER */}
      <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden print-slip">
        
        {/* Header */}
        <div className="bg-slate-950 p-6 text-center border-b border-slate-800 flex flex-col items-center">
          <div className="w-14 h-14 mb-2 drop-shadow-md">
            <img src="/nipma-bpms-logo.svg" alt="NiPMA BPMS Emblem" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-base md:text-lg font-bold uppercase tracking-wide text-white">
            NINGO-PRAMPRAM MUNICIPAL ASSEMBLY
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Building Permit Verification</p>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400 font-medium animate-pulse">{loadingMessage}</p>
            </div>
          ) : error ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl font-bold border border-red-500/20">
                ✕
              </div>
              <h2 className="text-xl font-bold text-red-400">Unverified Permit</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 text-xs bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition cursor-pointer no-print"
              >
                🔄 Retry
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Authenticated Banner */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-400 print-badge">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wide">AUTHENTIC PERMIT RECORD</h3>
                    <p className="text-xs text-emerald-300/80">Issued by NiPMA Works & Planning Department</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 font-mono font-bold">VERIFIED</span>
              </div>

              {/* Data Table */}
              <div className="space-y-3 text-xs bg-slate-900/60 p-5 rounded-xl border border-slate-700/60">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Permit Number:</span>
                  <span className="font-mono font-bold text-blue-400 text-sm">{permitNumber}</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Applicant / Owner:</span>
                  <span className="font-bold text-slate-200 uppercase">{applicantName}</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Date Issued:</span>
                  <span className="font-medium text-slate-300">{dateIssued}</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Purpose / Use:</span>
                  <span className="font-bold text-emerald-400 uppercase">{purpose}</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Location / Community:</span>
                  <span className="font-medium text-slate-300 uppercase">{location}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Site Address:</span>
                  <span className="font-medium text-slate-300 uppercase">{address}</span>
                </div>
              </div>

              {/* Print Slip Action */}
              <div className="no-print pt-2">
                <button
                  onClick={handlePrintSlip}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <span>🖨️ Print Official Verification Slip</span>
                </button>
              </div>

              {/* Print-Only Verification Footer */}
              <div className="hidden print:block pt-6 border-t border-gray-300 text-center text-[10px] text-gray-500 space-y-1">
                <p>Verified on: {new Date().toLocaleString('en-GB')}</p>
                <p>Official Digital Verification Seal • Ningo-Prampram Municipal Assembly</p>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 text-center text-xs text-slate-500 flex justify-between items-center no-print">
          <span>Building Permit Records Management System</span>
          <Link to="/" className="text-blue-400 hover:underline font-medium">
            Go to Portal
          </Link>
        </div>

      </div>
    </div>
  );
};

export default VerifyPermit;