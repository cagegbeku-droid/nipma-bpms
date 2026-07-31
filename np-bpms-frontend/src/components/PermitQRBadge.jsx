import React from 'react';

const PermitQRBadge = ({ permitNumber, applicantName, dateIssued, qrCodeBase64 }) => {
  
  // --- DOWNLOAD BADGE AS PNG ---
  const handleDownloadPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 440;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NIPDA MUNICIPAL ASSEMBLY', 200, 48);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.fillText('Official Verification Badge', 200, 68);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 80, 80, 240, 240);

      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(permitNumber || '', 200, 350);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px sans-serif';
      const name = (applicantName || '').toUpperCase();
      const displayName = name.length > 32 ? name.substring(0, 29) + '...' : name;
      ctx.fillText(displayName, 200, 380);

      const link = document.createElement('a');
      const cleanPermitNum = (permitNumber || 'badge').replace(/[\/\\]/g, '_');
      link.download = `Permit-Badge-${cleanPermitNum}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = qrCodeBase64;
  };

  return (
    <div 
      id="printable-qr-badge" 
      className="badge-container border border-gray-200 p-4 rounded-xl bg-white max-w-sm mx-auto shadow-md text-center"
    >
      <div className="mb-3">
        <h3 className="font-bold text-sm uppercase text-gray-900">NIPDA Municipal Assembly</h3>
        <p className="text-xs text-gray-500">Official Permit Verification Badge</p>
      </div>

      <div className="flex justify-center my-2 border p-2 rounded bg-white">
        <img src={qrCodeBase64} alt={`QR Code for ${permitNumber}`} className="w-48 h-48" />
      </div>

      <div className="text-center text-xs space-y-1">
        <p className="font-mono font-bold text-base text-blue-900">{permitNumber}</p>
        {applicantName && <p className="font-semibold text-gray-800 uppercase">{applicantName}</p>}
        {dateIssued && <p className="text-gray-500">Issued: {dateIssued}</p>}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-4 print:hidden">
        <button 
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition cursor-pointer"
        >
          🖨️ Print Badge
        </button>

        <button 
          onClick={handleDownloadPng}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition cursor-pointer"
        >
          ⬇️ Download PNG
        </button>
      </div>

      {/* ISOLATED PRINT CSS RULE */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-qr-badge, #printable-qr-badge * {
            visibility: visible !important;
          }
          #printable-qr-badge {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 100% !important;
            max-width: 320px !important;
            box-shadow: none !important;
            border: 2px solid #000 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PermitQRBadge;