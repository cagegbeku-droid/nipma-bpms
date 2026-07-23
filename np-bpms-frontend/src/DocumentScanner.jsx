import React, { useState, useEffect, useRef } from 'react';

const DocumentScanner = ({ documentTitle, onCancel, onSave }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedPages, setCapturedPages] = useState([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [flash, setFlash] = useState(false);

  // Start the device camera on mount
  useEffect(() => {
    let activeStream = null;
    const startCamera = async () => {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
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

    // Cleanup: turn off camera when component unmounts
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Capture current frame from video feed
  const capturePage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Trigger visual shutter flash effect
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    // Draw current video frame onto canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to a Blob / File object
    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `${documentTitle.replace(/\s+/g, '_')}_page_${capturedPages.length + 1}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      setCapturedPages(prev => [...prev, { file, previewUrl: URL.createObjectURL(blob) }]);
    }, 'image/jpeg', 0.85);
  };

  // Remove a specific captured page from the batch
  const removePage = (indexToRemove) => {
    setCapturedPages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Finish scanning and hand all pages back to NewPermit.jsx
  const handleFinishBatch = () => {
    if (capturedPages.length === 0) {
      alert("Please capture at least one page.");
      return;
    }
    // Stop camera stream before closing scanner
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    // Extract just the raw File objects to pass up
    const fileArray = capturedPages.map(p => p.file);
    onSave(fileArray);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col justify-between text-white">
      {/* Hidden canvas used for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Shutter flash overlay */}
      {flash && <div className="absolute inset-0 bg-white z-50 pointer-events-none opacity-75 transition-opacity"></div>}

      {/* Top Header */}
      <div className="flex justify-between items-center p-4 bg-gray-900 bg-opacity-80 border-b border-gray-800">
        <div>
          <h2 className="text-lg font-bold">Scanning: {documentTitle}</h2>
          <p className="text-xs text-blue-400">{capturedPages.length} Page(s) Captured in Batch</p>
        </div>
        <button 
          onClick={() => {
            if (stream) stream.getTracks().forEach(track => track.stop());
            onCancel();
          }} 
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          Cancel
        </button>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!isReviewing ? (
          /* Live Camera Viewfinder with Framing Guide */
          <div className="relative w-full h-full flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
            {/* Document Edge-Detection Alignment Guide Box */}
            <div className="absolute border-2 border-dashed border-blue-400 rounded-lg w-[85%] h-[80%] pointer-events-none flex flex-col justify-between p-4 opacity-75">
              <div className="flex justify-between text-blue-300 text-xs font-mono">
                <span>[ CORNER A ]</span>
                <span>[ CORNER B ]</span>
              </div>
              <div className="text-center text-blue-200 text-xs bg-black bg-opacity-40 py-1 rounded">
                Align paper within borders & snap pages sequentially
              </div>
              <div className="flex justify-between text-blue-300 text-xs font-mono">
                <span>[ CORNER C ]</span>
                <span>[ CORNER D ]</span>
              </div>
            </div>
          </div>
        ) : (
          /* Gallery Review Grid View */
          <div className="w-full h-full p-6 overflow-y-auto bg-gray-900">
            <h3 className="text-xl font-bold mb-4 text-center">Review Scanned Pages ({capturedPages.length})</h3>
            {capturedPages.length === 0 ? (
              <p className="text-center text-gray-400 py-12">No pages captured yet. Go back and snap some pages!</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {capturedPages.map((page, index) => (
                  <div key={index} className="relative bg-gray-800 rounded-lg p-2 border border-gray-700 group">
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
      <div className="p-6 bg-gray-900 bg-opacity-90 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
        {!isReviewing ? (
          <>
            <div className="flex items-center space-x-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                {capturedPages.length} Pages ready
              </span>
            </div>

            <div className="flex space-x-3">
              <button 
                type="button" 
                onClick={capturePage} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform active:scale-95 transition flex items-center space-x-2 text-lg"
              >
                <span>📸 Snap Page</span>
              </button>

              <button 
                type="button" 
                onClick={() => setIsReviewing(true)} 
                disabled={capturedPages.length === 0}
                className={`font-semibold py-3 px-6 rounded-full transition ${
                  capturedPages.length > 0 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                Review & Finish ({capturedPages.length})
              </button>
            </div>
          </>
        ) : (
          <>
            <button 
              type="button" 
              onClick={() => setIsReviewing(false)} 
              className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              ← Back to Camera
            </button>

            <button 
              type="button" 
              onClick={handleFinishBatch} 
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition"
            >
              Save All {capturedPages.length} Pages to Vault ✓
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentScanner;