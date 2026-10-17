import React, { useState, useEffect, useRef } from 'react';

const DocumentViewerModal = ({ isOpen, onClose, documentUrl, title }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef(null);

  // Reset zoom, rotation and loading state whenever a new document is opened
  useEffect(() => {
    setIsLoading(true);
    setScale(1);
    setRotation(0);
  }, [documentUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScale(prev => Math.min(prev + 0.25, 3));
      } else if (e.key === '-') {
        e.preventDefault();
        setScale(prev => Math.max(prev - 0.25, 0.5));
      } else if (e.key === '0') {
        e.preventDefault();
        setScale(1);
        setRotation(0);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRotation(prev => (prev + 90) % 360);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreen(prev => !prev);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isFullscreen]);

  if (!isOpen || !documentUrl) return null;

  // Extract Google Drive ID if present
  const getDriveId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:file\/d\/|id=)([\w-]+)/);
    return match ? match[1] : null;
  };

  const driveId = getDriveId(documentUrl);

  // Convert standard Google Drive view/edit links to iframe embed preview links
  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (driveId) {
      return `https://drive.google.com/file/d/${driveId}/preview`;
    }
    if (url.includes('drive.google.com')) {
      return url.replace(/\/view(\?.*)?$/, '/preview').replace(/\/edit(\?.*)?$/, '/preview');
    }
    return url;
  };

  const getDirectDownloadUrl = (url) => {
    if (driveId) {
      return `https://drive.google.com/uc?export=download&id=${driveId}`;
    }
    return url;
  };

  const isImageFile = (url) => {
    if (!url) return false;
    return /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(url);
  };

  const embedUrl = getEmbedUrl(documentUrl);
  const isImg = isImageFile(documentUrl);

  const handleZoomIn = () => setScale(prev => Math.min(Number((prev + 0.25).toFixed(2)), 3));
  const handleZoomOut = () => setScale(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.5));
  const handleResetZoom = () => {
    setScale(1);
    setRotation(0);
  };
  const handleRotateRight = () => setRotation(prev => (prev + 90) % 360);
  const handleRotateLeft = () => setRotation(prev => (prev - 90 + 360) % 360);

  const handlePrint = () => {
    if (isImg) {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <html>
            <head><title>${title || 'Document Print'}</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;">
              <img src="${documentUrl}" style="max-width:100%;max-height:100%;transform:rotate(${rotation}deg);" onload="window.print();window.close();" />
            </body>
          </html>
        `);
        printWin.document.close();
      }
    } else {
      window.open(documentUrl, '_blank');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-1 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className={`bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-700 transition-all duration-200 ${
          isFullscreen 
            ? 'w-screen h-screen rounded-none border-none' 
            : 'w-full max-w-6xl h-[92vh] sm:h-[88vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex flex-wrap justify-between items-center px-4 sm:px-6 py-3 bg-gray-900 text-white border-b border-gray-800 gap-2 shrink-0">
          <div className="flex items-center space-x-2.5 truncate max-w-[55%]">
            <span className="text-xl">📄</span>
            <div className="truncate">
              <h3 className="font-bold text-sm sm:text-base truncate text-gray-100">
                {title || 'Document Preview'}
              </h3>
              <p className="text-[11px] text-gray-400 truncate">
                {isImg ? 'High-Resolution Image Archive' : 'Interactive Document / PDF Viewer'}
              </p>
            </div>
          </div>
          
          {/* Action Tools Header */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Download Button */}
            <a 
              href={getDirectDownloadUrl(documentUrl)} 
              target="_blank" 
              rel="noopener noreferrer" 
              download
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 transition flex items-center space-x-1.5 shadow-xs"
              title="Download file to device"
            >
              <span>💾</span>
              <span className="hidden sm:inline">Download</span>
            </a>

            {/* Print Button */}
            <button 
              onClick={handlePrint}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Print document"
            >
              <span>🖨️</span>
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* External Tab */}
            <a 
              href={documentUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-gray-700 transition flex items-center space-x-1"
              title="Open in new browser window"
            >
              <span>↗</span>
            </a>

            {/* Fullscreen Toggle */}
            <button 
              onClick={() => setIsFullscreen(prev => !prev)}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white px-2.5 py-1.5 rounded-lg border border-gray-700 transition cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
            >
              {isFullscreen ? '⛷️ Exit' : '⛶ Full'}
            </button>

            {/* Close */}
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 transition cursor-pointer ml-1"
              title="Close (Esc)"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Floating Zoom & Rotate Toolbar (for fine inspection of blueprints & drawings) */}
        <div className="bg-gray-800/90 backdrop-blur-md px-4 py-2 border-b border-gray-700/80 flex items-center justify-between text-xs text-gray-300 gap-2 shrink-0">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <span className="font-semibold text-gray-400 hidden sm:inline">Zoom:</span>
            <button 
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-gray-100 font-bold cursor-pointer transition shadow-2xs"
              title="Zoom Out (-)"
            >
              −
            </button>
            <span className="font-mono text-blue-400 font-bold px-1.5">
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={handleZoomIn}
              disabled={scale >= 3}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-gray-100 font-bold cursor-pointer transition shadow-2xs"
              title="Zoom In (+)"
            >
              +
            </button>
            {(scale !== 1 || rotation !== 0) && (
              <button 
                onClick={handleResetZoom}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 text-[11px] cursor-pointer transition"
                title="Reset zoom and rotation (0)"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-gray-400 hidden sm:inline">Rotate:</span>
            <button 
              onClick={handleRotateLeft}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-100 font-semibold cursor-pointer transition flex items-center space-x-1 shadow-2xs"
              title="Rotate Left 90°"
            >
              <span>↶</span>
              <span className="hidden md:inline">-90°</span>
            </button>
            <button 
              onClick={handleRotateRight}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-100 font-semibold cursor-pointer transition flex items-center space-x-1 shadow-2xs"
              title="Rotate Right 90° (R)"
            >
              <span>↷</span>
              <span className="hidden md:inline">+90°</span>
            </button>
            {rotation !== 0 && (
              <span className="text-amber-400 font-mono text-[11px] font-semibold pl-1">
                {rotation}°
              </span>
            )}
          </div>
        </div>

        {/* Modal Body / Embedded Viewer */}
        <div className="flex-1 bg-gray-950 relative flex items-center justify-center overflow-auto p-2">
          
          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-950/80 text-white space-y-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400 font-medium">Loading document preview...</p>
            </div>
          )}

          {isImg ? (
            <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-4">
              <img 
                src={documentUrl} 
                alt={title || 'Document'} 
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out'
                }}
                className="max-w-full max-h-full object-contain drop-shadow-xl select-none"
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
              />
            </div>
          ) : (
            <div 
              style={{
                width: `${scale * 100}%`,
                height: `${scale * 100}%`,
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out'
              }}
              className="w-full h-full min-h-[450px]"
            >
              <iframe 
                src={embedUrl} 
                className="w-full h-full border-0 rounded-lg shadow-inner"
                title={title || 'Document Preview'}
                allow="autoplay"
                onLoad={() => setIsLoading(false)}
              />
            </div>
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="bg-gray-900 px-4 sm:px-6 py-2.5 border-t border-gray-800 text-xs text-gray-400 flex flex-wrap justify-between items-center gap-2 shrink-0">
          <div className="flex items-center space-x-3">
            <span className="font-medium text-gray-300">NiPMA BPMS Document Archive</span>
            <span className="text-gray-600 hidden sm:inline">|</span>
            <span className="text-gray-500 hidden sm:inline">Shortcuts: <strong>+ / -</strong> Zoom &bull; <strong>R</strong> Rotate &bull; <strong>F</strong> Fullscreen &bull; <strong>Esc</strong> Close</span>
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-lg transition cursor-pointer border border-gray-700 text-xs"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
};

export default DocumentViewerModal;