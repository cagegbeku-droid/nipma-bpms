import React from 'react';

const DocumentViewerModal = ({ isOpen, onClose, documentUrl, title }) => {
  if (!isOpen || !documentUrl) return null;

  // Convert standard Google Drive view/edit links to iframe embed preview links
  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      return url.replace(/\/view(\?.*)?$/, '/preview').replace(/\/edit(\?.*)?$/, '/preview');
    }
    return url;
  };

  const embedUrl = getEmbedUrl(documentUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-gray-200">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-gray-900 text-white border-b border-gray-800">
          <div className="flex items-center space-x-2 truncate">
            <span className="text-xl">📄</span>
            <h3 className="font-bold text-lg truncate text-gray-100">
              {title || 'Document Preview'}
            </h3>
          </div>
          
          <div className="flex items-center space-x-3">
            <a 
              href={documentUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded border border-gray-700 transition"
              title="Open in external browser tab if needed"
            >
              Open External ↗
            </a>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 transition cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Modal Body / Embedded Viewer */}
        <div className="flex-1 bg-gray-100 relative">
          <iframe 
            src={embedUrl} 
            className="w-full h-full border-0"
            title={title || 'Document Preview'}
            allow="autoplay"
          />
        </div>
        
        {/* Modal Footer */}
        <div className="bg-white px-6 py-2.5 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>NIPDA BPMS Secure Document Vault</span>
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