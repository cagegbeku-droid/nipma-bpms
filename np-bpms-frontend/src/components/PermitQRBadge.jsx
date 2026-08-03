import React from 'react';

const PermitQRBadge = ({ permitNumber, dateIssued, qrCodeBase64 }) => {
  
  // --- DOWNLOAD BADGE STICKER AS PNG ---
  const handleDownloadPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 340;
    const ctx = canvas.getContext('2d');

    // 1. White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Outer Dark Border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    // 3. Header Text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NIPDA MUNICIPAL ASSEMBLY', 250, 48);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('OFFICIAL BUILDING PERMIT SITE STICKER', 250, 68);

    // Divider Line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 80);
    ctx.lineTo(470, 80);
    ctx.stroke();

    // 4. BOLD PERMIT NUMBER IN THE MIDDLE
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PERMIT REFERENCE NUMBER', 250, 115);

    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(permitNumber || '', 250, 150);

    // 5. Site Notice & Date on Bottom Left
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b45309'; // Amber notice
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('MUST BE DISPLAYED ON BUILDING SITE', 30, 220);

    if (dateIssued) {
      ctx.fillStyle = '#334155';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Date Issued: ${dateIssued}`, 30, 245);
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText('Scan QR code to verify authenticity.', 30, 270);

    // 6. Draw QR Code at Bottom-Right
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Positioned at bottom right corner
      ctx.drawImage(img, 350, 180, 115, 115);

      const link = document.createElement('a');
      const cleanPermitNum = (permitNumber || 'badge').replace(/[\/\\]/g, '_');
      link.download = `Permit-Site-Badge-${cleanPermitNum}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = qrCodeBase64;
  };

  return (
    <div 
      id="printable-qr-badge" 
      className="badge-container border-4 border-slate-900 p-6 rounded-2xl bg-white max-w-md mx-auto shadow-xl relative overflow-hidden"
    >
      {/* Header */}
      <div className="text-center border-b border-gray-200 pb-3 mb-4">
        <h3 className="font-extrabold text-base uppercase text-slate-900 tracking-wide">NIPDA Municipal Assembly</h3>
        <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Official Building Permit Site Sticker</p>
      </div>

      {/* BOLD PERMIT NUMBER IN THE MIDDLE */}
      <div className="my-4 text-center bg-slate-50 py-4 px-2 rounded-xl border border-slate-200">
        <p className="text-[10px] uppercase font-extrabold text-slate-400 mb-1 tracking-wider">Permit Reference Number</p>
        <p className="font-mono font-black text-2xl md:text-3xl text-blue-900 tracking-wider break-all">
          {permitNumber}
        </p>
      </div>

      {/* Bottom Section: Details on Left | QR Code on Bottom Right */}
      <div className="flex justify-between items-end pt-2">
        <div className="text-left space-y-1 pr-2">
          <span className="inline-block bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2 py-0.5 rounded border border-amber-300 uppercase mb-1">
            Must Be Displayed On Site
          </span>
          {dateIssued && (
            <p className="text-xs font-semibold text-slate-700">
              Date Issued: <span className="font-bold text-slate-900">{dateIssued}</span>
            </p>
          )}
          <p className="text-[10px] text-slate-400 max-w-[190px]">
            Scan QR code with smartphone camera to verify authenticity.
          </p>
        </div>

        {/* QR Code in Bottom Right */}
        <div className="flex-shrink-0 border-2 border-slate-900 p-1 rounded-xl bg-white shadow-sm">
          <img src={qrCodeBase64} alt={`QR Code for ${permitNumber}`} className="w-28 h-28 object-contain" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mt-6 print:hidden">
        <button 
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center space-x-1"
        >
          <span>🖨️ Print Badge</span>
        </button>

        <button 
          onClick={handleDownloadPng}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center space-x-1"
        >
          <span>⬇️ Download PNG</span>
        </button>
      </div>

      {/* Isolated Print Rules */}
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
            max-width: 450px !important;
            box-shadow: none !important;
            border: 4px solid #000 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PermitQRBadge;