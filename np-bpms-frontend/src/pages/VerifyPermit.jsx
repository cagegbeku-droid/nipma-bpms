import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const VerifyPermit = () => {
  const [searchParams] = useSearchParams();
  const permitNumFromUrl = searchParams.get('id') || searchParams.get('permitNumber');

  const [permit, setPermit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!permitNumFromUrl) {
      setError('No permit number provided in verification URL.');
      setLoading(false);
      return;
    }

    const verifyRecord = async () => {
      try {
        const response = await fetch(
          `https://nipma-bpms-backend.onrender.com/api/permits/verify/${encodeURIComponent(permitNumFromUrl)}`
        );
        const data = await response.json();

        if (data.success && data.data) {
          setPermit(data.data);
        } else {
          setError(data.message || 'Permit not found in official archives.');
        }
      } catch (err) {
        console.error('Verification Fetch Error:', err);
        setError('Unable to connect to verification server. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    verifyRecord();
  }, [permitNumFromUrl]);

  // Extract field values safely
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
              <p className="text-sm text-slate-400">Verifying permit credentials against official records...</p>
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
                  <span className="font-medium text-slate-300 uppercase">{location || 'N/A'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Site Address:</span>
                  <span className="font-medium text-slate-300 uppercase">{address || 'N/A'}</span>
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