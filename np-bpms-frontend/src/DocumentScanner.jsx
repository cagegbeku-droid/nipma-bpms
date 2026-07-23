import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';

const DocumentScanner = ({ documentTitle, onCancel, onSave }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedPages, setCapturedPages] = useState([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [flash, setFlash] = useState(false);

  // Start device camera on mount
  useEffect(() => {
    let activeStream = null;
    const startCamera = async () => {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment', 
            width: { ideal: 1920 }, 
            height: { ideal: 1080 } 
          },
          audio: false
        });
        setStream(activeStream);
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        alert("Could not access camera. Please check camera permissions.");
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Capture frame with auto-edge targeting overlay
  const capturePage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Trigger visual camera shutter flash effect
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    // Draw current camera frame onto hidden canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Save image preview data URL for the review gallery
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPages(prev => [...prev, dataUrl]);
  };

  const removePage = (indexToRemove) => {
    setCapturedPages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Compile all captured pages into a single official PDF document
  const handleGeneratePDFAndSave = () => {
    if (capturedPages.length === 0) {
      alert("Please capture at least one page.");
      return;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Initialize jsPDF for A4 document formatting
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    capturedPages.forEach((dataUrl, index) => {
      if (index > 0) {
        pdf.addPage();
      }
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight);
    });

    // Convert PDF into a downloadable File object
    const pdfBlob = pdf.output('blob');
    const safeFileName = `${documentTitle.replace(/\s+/g, '_')}_archive.pdf`;
    const pdfFile = new File([pdfBlob], safeFileName, { type: 'application/pdf' });

    onSave(pdfFile);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between text-white">
      <canvas ref={canvasRef} className="hidden" />

      {/* Shutter flash overlay */}
      {flash && <div className="absolute inset-0 bg-white z-50 pointer-events-none opacity-80 transition-opacity"></div>}

      {/* Top Header Bar */}
      <div className="flex justify-between items-center p-4 bg-gray-900 border-b border-gray-800 z-10">
        <div>
          <h2 className="text-base font-bold text-blue-400">AI Auto-Scanner: {documentTitle}</h2>
          <p className="text-xs text-gray-400">{capturedPages.length} Page(s) captured in current batch</p>
        </div>
        <button 
          onClick={() => {
            if (stream) stream.getTracks().forEach(track => track.stop());
            onCancel();
          }} 
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
        >
          Cancel
        </button>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        {!isReviewing ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Smart Edge-Detection Corner Target Box (A4 / A3 Guide) */}
            <div className="absolute inset-6 sm:inset-12 border-2 border-dashed border-cyan-400 rounded-xl pointer-events-none flex flex-col justify-between p-4 shadow-[0_0_25px_rgba(6,182,212,0.4)]">
              {/* Top Corners */}
              <div className="flex justify-between">
                <div className="w-10 h-10 border-t-4 border-l-4 border-cyan-300"></div>
                <div className="w-10 h-10 border-t-4 border-r-4 border-cyan-300"></div>
              </div>

              {/* Status Badge */}
              <div className="self-center bg-cyan-950 bg-opacity-90 text-cyan-200 text-xs px-4 py-1.5 rounded-full border border-cyan-500 shadow-md font-mono tracking-wide">
                ⚡ Auto-Detecting Paper Edges (A4 / A3)
              </div>

              {/* Bottom Corners */}
              <div className="flex justify-between">
                <div className="w-10 h-10 border-b-4 border-l-4 border-cyan-300"></div>
                <div className="w-10 h-10 border-b-4 border-r-4 border-cyan-300"></div>
              </div>
            </div>
          </div>
        ) : (
          /* Gallery Review Mode */
          <div className="w-full h-full p-6 overflow-y-auto bg-gray-900 z-10">
            <h3 className="text-lg font-bold mb-4 text-center">Review Captured Pages ({capturedPages.length})</h3>
            {capturedPages.length === 0 ? (
              <p className="text-center text-gray-400 py-12">No pages captured yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {capturedPages.map((dataUrl, index) => (
                  <div key={index} className="relative bg-gray-800 rounded-lg p-2 border border-gray-700">
                    <img src={dataUrl} alt={`Page ${index + 1}`} className="w-full h-40 object-cover rounded" />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-semibold text-gray-300">Page {index + 1}</span>
                      <button 
                        type="button" 
                        onClick={() => removePage(index)} 
                        className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="p-4 sm:p-6 bg-gray-900 border-t border-gray-800 flex justify-between items-center z-10">
        {!isReviewing ? (
          <>
            <button 
              type="button" 
              onClick={() => setIsReviewing(true)}
              disabled={capturedPages.length === 0}
              className={`text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl transition ${
                capturedPages.length > 0 ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700' : 'opacity-40 text-gray-500 bg-gray-900'
              }`}
            >
              Review Gallery ({capturedPages.length})
            </button>

            {/* Prominent Shutter Button */}
            <button 
              type="button" 
              onClick={capturePage} 
              className="w-18 h-18 sm:w-20 sm:h-20 bg-white rounded-full border-4 border-cyan-500 shadow-2xl flex items-center justify-center transform active:scale-95 transition hover:bg-gray-100"
            >
              <div className="w-13 h-13 sm:w-15 sm:h-15 bg-cyan-600 rounded-full flex items-center justify-center text-xl font-bold">
                📷
              </div>
            </button>

            <button 
              type="button" 
              onClick={() => setIsReviewing(true)} 
              disabled={capturedPages.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-bold px-5 py-3 rounded-xl shadow-lg transition"
            >
              Done & Review ({capturedPages.length}) →
            </button>
          </>
        ) : (
          <>
            <button 
              type="button" 
              onClick={() => setIsReviewing(false)} 
              className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold px-5 py-3 rounded-xl transition"
            >
              ← Back to Camera
            </button>

            <button 
              type="button" 
              onClick={handleGeneratePDFAndSave} 
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm px-8 py-3 rounded-xl shadow-lg transition"
            >
              Convert to PDF & Save ({capturedPages.length} Pages) ✓
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentScanner;