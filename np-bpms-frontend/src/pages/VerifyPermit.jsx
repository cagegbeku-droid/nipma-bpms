import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const VerifyPermit = () => {
  const [searchParams] = useSearchParams();
  const rawPermitNum = searchParams.get('id') || searchParams.get('permitNumber');

  const [permit, setPermit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingLoadingMessage] = useState('Connecting to verification server...');
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

      // Helper function to fetch with retry for Render cold starts
      const fetchWithRetry = async (url, retries = 2) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            if (attempt > 0) {
              setLoadingLoadingMessage(`Waking up archive server (attempt ${attempt + 1}/${retries + 1})...`);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

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
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
          }
        }
        throw new Error('Server unreachable');
      };

      try {
        setLoadingLoadingMessage('Verifying permit credentials against official records...');

        // 1. Primary endpoint (Query Parameter)
        let data;
        try {
          data = await fetchWithRetry(`${BACKEND_URL}/verify-record?permitNumber=${encodedNum}`);
        } catch (e) {
          // 2. Fallback endpoint (Wildcard Path)
          data = await fetchWithRetry(`${BACKEND_URL}/verify/${encodedNum}`);
        }

        if (data && data.success && data.data) {
          setPermit(data.data);
        } else {
          setError((data && data.message) || `Permit "${cleanPermitNum}" not found in official archives.`);
        }

      } catch (err) {
        console.error('Verification Fetch Error:', err);
        setError('Unable to connect to verification server. Please ensure you have internet access and try again.');
      } finally {
        setLoading(false);
      }
    };

    verifyRecord();
  }, [rawPermitNum]);

  // Extract field values safely with dual key fallbacks
  const permitNumber = permit ? (permit.permit_number || permit.permitNumber || 'N/A') : '';
  const applicantName = permit ? (permit.applicant_name || permit.applicantName || 'N/A') : '';
  const dateIssued = permit ? (permit.date_issued || permit.dateIssued || 'N/A') : '';
  const purpose = permit ? (permit.purpose || 'N/A') : '';
  const location = permit ? (permit.location || 'N/A') : '';
  const address = permit ? (permit.address || 'N/A') : '';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-950 p-6 text-center border-b border-slate-800">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xl mb-2">
            🏛️
          </div>
          <h1 className="text-xl font-bold uppercase tracking-wide text-white">NIPDA Municipal Assembly</h1>
          <p className="text-xs text-slate-400 mt-1">Official Building Permit Verification Portal</p>
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
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-xs text-red-300">
                ⚠️ Warning: This document or QR code does not match any active record in the NIPDA Building Permit Management System.
              </div>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 text-xs bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition"
              >
                🔄 Retry Connection
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Authenticated Banner */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-3 text-emerald-400">
                <span className="text-2xl">✅</span>
                <div>
                  <h3 className="font-bold text-sm">AUTHENTIC PERMIT RECORD</h3>
                  <p className="text-xs text-emerald-300/80">Issued by NIPDA Works Department</p>
                </div>
              </div>

              {/* Data Table */}
              <div className="space-y-3 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Permit Number:</span>
                  <span className="font-mono font-bold text-blue-400 text-sm">{permitNumber}</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Applicant / Owner:</span>
                  <span className="font-bold text-slate-200 uppercase">{applicantName}</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Date Issued:</span>
                  <span className="font-medium text-slate-300">{dateIssued}</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Purpose / Use:</span>
                  <span className="font-bold text-emerald-400 uppercase">{purpose}</span>
                </div>

                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Location:</span>
                  <span className="font-medium text-slate-300 uppercase">{location}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Site Address:</span>
                  <span className="font-medium text-slate-300 uppercase">{address}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 text-center text-xs text-slate-500 flex justify-between items-center">
          <span>NIPDA BPMS Archive Verification</span>
          <Link to="/" className="text-blue-400 hover:underline font-medium">
            Go to Portal
          </Link>
        </div>

      </div>
    </div>
  );
};

export default VerifyPermit;