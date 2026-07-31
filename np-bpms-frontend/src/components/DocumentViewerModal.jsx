import React, { useState, useEffect } from 'react';

const DocumentViewerModal = ({ isOpen, onClose, documentUrl, title }) => {
  const [isLoading, setIsLoading] = useState(true);

  // Close modal when pressing the Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset loading spinner whenever a new document is opened
  useEffect(() => {
    setIsLoading(true);
  }, [documentUrl]);

  if (!isOpen || !documentUrl) return null;

  // Convert standard Google Drive view/edit links to iframe embed preview links
  const getEmbedUrl = (url) => {
    if (!url) return '';
    
    // Extract file ID from Google Drive links (handles file/d/ID, open?id=ID, uc?id=ID)
    const driveMatch = url.match(/(?:file\/d\/|id=)([\w-]+)/);
    if (url.includes('drive.google.com') && driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    if (url.includes('drive.google.com')) {
      return url.replace(/\/view(\?.*)?$/, '/preview').replace(/\/edit(\?.*)?$/, '/preview');
    }

    return url;
  };

  const isImageFile = (url) => {
    if (!url) return false;
    return /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(url);
  };

  const embedUrl = getEmbedUrl(documentUrl);
  const isImg = isImageFile(documentUrl);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal box
      >
        
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 bg-gray-900 text-white border-b border-gray-800">
          <div className="flex items-center space-x-2.5 truncate max-w-[65%]">
            <span className="text-xl">📄</span>
            <h3 className="font-bold text-base sm:text-lg truncate text-gray-100">
              {title || 'Document Preview'}
            </h3>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <a 
              href={documentUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded border border-gray-700 transition flex items-center space-x-1"
              title="Open in external browser tab if needed"
            >
              <span>Open External</span>
              <span>↗</span>
            </a>

            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 transition cursor-pointer"
              title="Close (Esc)"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Modal Body / Embedded Viewer */}
        <div className="flex-1 bg-gray-900 relative flex items-center justify-center overflow-hidden">
          
          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-900/90 text-white space-y-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400 font-medium">Loading document preview...</p>
            </div>
          )}

          {isImg ? (
            <img 
              src={documentUrl} 
              alt={title || 'Document'} 
              className="max-w-full max-h-full object-contain p-2"
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          ) : (
            <iframe 
              src={embedUrl} 
              className="w-full h-full border-0"
              title={title || 'Document Preview'}
              allow="autoplay"
              onLoad={() => setIsLoading(false)}
            />
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="bg-white px-4 sm:px-6 py-2.5 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span className="truncate">NIPDA BPMS Secure Document Vault</span>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 text-gray-800 font-semibold rounded hover:bg-gray-300 transition cursor-pointer"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
};

export default DocumentViewerModal;