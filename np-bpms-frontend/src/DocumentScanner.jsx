import React, { useState, useEffect, useRef } from 'react';

const DocumentScanner = ({ documentTitle, onCancel, onSave }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedPages, setCapturedPages] = useState([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [autoDetectMode, setAutoDetectMode] = useState(true);

  // Start the device camera on mount
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

  // Capture frame with simulated document edge clipping
  const capturePage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    // Draw current camera frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `${documentTitle.replace(/\s+/g, '_')}_page_${capturedPages.length + 1}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      setCapturedPages(prev => [...prev, { file, previewUrl: URL.createObjectURL(blob) }]);
    }, 'image/jpeg', 0.90);
  };

  const removePage = (indexToRemove) => {
    setCapturedPages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleFinishBatch = () => {
    if (capturedPages.length === 0) {
      alert("Please capture at least one page.");
      return;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    const fileArray = capturedPages.map(p => p.file);
    onSave(fileArray);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between text-white">
      <canvas ref={canvasRef} className="hidden" />

      {/* Shutter flash effect */}
      {flash && <div className="absolute inset-0 bg-white z-50 pointer-events-none opacity-80 transition-opacity"></div>}

      {/* Top Header Bar */}
      <div className="flex justify-between items-center p-4 bg-gray-900 border-b border-gray-800 z-10">
        <div>
          <h2 className="text-base font-bold text-blue-400">Smart Scanner: {documentTitle}</h2>
          <p className="text-xs text-gray-400">{capturedPages.length} Page(s) in current batch</p>
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

            {/* AI Document Edge Detection Corner Target Box */}
            <div className="absolute inset-8 sm:inset-16 border-2 border-blue-500 rounded-xl pointer-events-none flex flex-col justify-between p-4 shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-pulse">
              
              {/* Top Corners */}
              <div className="flex justify-between">
                <div className="w-8 h-8 border-t-4 border-l-4 border-white"></div>
                <div className="w-8 h-8 border-t-4 border-r-4 border-white"></div>
              </div>

              {/* Center Guidance Badge */}
              <div className="self-center bg-blue-900 bg-opacity-80 text-blue-200 text-xs px-3 py-1 rounded-full border border-blue-400 shadow-md">
                Align paper corners inside frame (A4/A3)
              </div>

              {/* Bottom Corners */}
              <div className="flex justify-between">
                <div className="w-8 h-8 border-b-4 border-l-4 border-white"></div>
                <div className="w-8 h-8 border-b-4 border-r-4 border-white"></div>
              </div>
            </div>
          </div>
        ) : (
          /* Gallery Review Mode */
          <div className="w-full h-full p-6 overflow-y-auto bg-gray-900 z-10">
            <h3 className="text-lg font-bold mb-4 text-center">Review Scanned Pages ({capturedPages.length})</h3>
            {capturedPages.length === 0 ? (
              <p className="text-center text-gray-400 py-12">No pages captured yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {capturedPages.map((page, index) => (
                  <div key={index} className="relative bg-gray-800 rounded-lg p-2 border border-gray-700">
                    <img src={page.previewUrl} alt={`Page ${index + 1}`} className="w-full h-40 object-cover rounded" />
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

            {/* Main Shutter Button */}
            <button 
              type="button" 
              onClick={capturePage} 
              className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full border-4 border-blue-600 shadow-xl flex items-center justify-center transform active:scale-95 transition hover:bg-gray-100"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-full flex items-center text-white justify-center font-bold text-xl">
                📷
              </div>
            </button>

            <button 
              type="button" 
              onClick={() => setIsReviewing(true)} 
              disabled={capturedPages.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-bold px-5 py-3 rounded-xl shadow-lg transition"
            >
              Done & Save ({capturedPages.length}) →
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
              onClick={handleFinishBatch} 
              className="bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-8 py-3 rounded-xl shadow-lg transition"
            >
              Upload All {capturedPages.length} Pages to Vault ✓
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentScanner;