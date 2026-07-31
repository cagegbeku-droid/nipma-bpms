// src/components/PermitQRBadge.jsx
import React from 'react';

const PermitQRBadge = ({ permitNumber, applicantName, dateIssued, qrCodeBase64 }) => {
  const handlePrint = () => window.print();

  return (
    <div className="badge-container border p-4 rounded-lg bg-white max-w-sm shadow-md">
      <div className="text-center mb-3">
        <h3 className="font-bold text-sm uppercase">NIPDA Municipal Assembly</h3>
        <p className="text-xs text-gray-500">Official Permit Verification Badge</p>
      </div>

      <div className="flex justify-center my-2">
        <img src={qrCodeBase64} alt={`QR Code for ${permitNumber}`} className="w-48 h-48 border p-1" />
      </div>

      <div className="text-center text-xs space-y-1">
        <p className="font-mono font-bold text-base text-blue-900">{permitNumber}</p>
        <p className="font-semibold text-gray-800">{applicantName}</p>
        <p className="text-gray-500">Issued: {dateIssued}</p>
      </div>

      <button 
        onClick={handlePrint}
        className="print:hidden mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        🖨️ Print Badge Sticker
      </button>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .badge-container, .badge-container * { visibility: visible; }
          .badge-container { position: absolute; left: 0; top: 0; width: 100%; border: none; shadow: none; }
        }
      `}</style>
    </div>
  );
};

export default PermitQRBadge;