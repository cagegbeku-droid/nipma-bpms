import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  HomeIcon, 
  ArrowUpTrayIcon, 
  ArchiveBoxIcon, 
  ArrowLeftOnRectangleIcon, 
  KeyIcon,
  DevicePhoneMobileIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'; 

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Upload Archive', href: '/permits/new', icon: ArrowUpTrayIcon },
  { name: 'Registry', href: '/permits/historical', icon: ArchiveBoxIcon },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // --- JWT USER CHECK (STRICTLY VIA SESSION STORAGE) ---
  const token = sessionStorage.getItem('token');
  const savedUser = sessionStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  const isLoggedIn = Boolean(token && user);

  // --- PWA MOBILE INSTALL PROMPT DETECTOR ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallAppClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Show step-by-step installation guide for iOS Safari / Chrome fallback
      setShowInstallGuide(true);
    }
  };

  // --- FILTER NAVIGATION LINKS ---
  const filteredNavigation = navigation.filter((item) => {
    if (!isLoggedIn && item.name === 'Upload Archive') {
      return false;
    }
    return true;
  });

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    // Force a fresh render to the public Dashboard
    window.location.href = '/';
  };

  const handleLoginClick = () => {
    navigate('/vault-admin');
  };

  return (
    <div className="flex flex-col w-full md:w-64 bg-gray-900 text-white shrink-0 md:min-h-screen justify-between relative">
      
      <div>
        {/* --- HEADER LOGO & TITLE --- */}
        <div className="flex flex-col items-center justify-center py-4 md:py-6 border-b border-gray-800">
          <img 
            src="/465783232_1385047576154895_1881211722468502227_n.jpg" 
            alt="NiPMA Logo" 
            className="h-16 w-16 md:h-24 md:w-24 rounded-full bg-white object-contain mb-2 md:mb-4 p-1 shadow-md" 
          />
          <h1 className="text-xs md:text-sm font-bold tracking-wider text-center px-4 text-blue-400 leading-snug">
            NINGO-PRAMPRAM<br/>MUNICIPAL ASSEMBLY
          </h1>
          <p className="text-[10px] md:text-xs text-blue-100 mt-2 md:mt-3 font-semibold text-center px-2 tracking-wide uppercase bg-gray-800 py-1 w-full border-y border-gray-700">
            NiPMA Building Permit System
          </p>
        </div>

        {/* --- NAVIGATION LINKS --- */}
        <div className="py-2 md:py-4">
          <nav className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-1 px-2">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap " +
                  (isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white")
                }
              >
                <item.icon className="mr-2 md:mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* --- BOTTOM CORNER CONTROLS --- */}
      <div className="p-3 border-t border-gray-800 flex flex-col space-y-3 text-xs">
        
        {/* MOBILE APP INSTALLATION BUTTON (ALWAYS VISIBLE) */}
        <button
          onClick={handleInstallAppClick}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-md transition flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
        >
          <DevicePhoneMobileIcon className="h-4 w-4" />
          <span>Install Mobile App</span>
        </button>

        {isLoggedIn ? (
          <div className="space-y-2">
            <div className="px-1 text-gray-400">
              <p className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Logged In Officer</p>
              <p className="text-white font-medium truncate">{user?.name || user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-red-400 hover:text-red-300 font-medium transition flex items-center justify-between bg-red-950/40 px-3 py-1.5 rounded border border-red-900/50 cursor-pointer"
            >
              <span>Log Out Session</span>
              <ArrowLeftOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">v1.0</span>
            <button
              onClick={handleLoginClick}
              className="text-gray-300 hover:text-white font-medium transition flex items-center space-x-1.5 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded border border-gray-700 cursor-pointer"
            >
              <KeyIcon className="h-3.5 w-3.5 text-blue-400" />
              <span>Officer Portal</span>
            </button>
          </div>
        )}
      </div>

      {/* --- MOBILE INSTALLATION GUIDE MODAL (FOR IPHONE & CHROME FALLBACK) --- */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-gray-800">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative space-y-4 animate-fadeIn">
            <button 
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-3xl">📱</span>
              <h3 className="font-bold text-lg text-gray-900">Install NIPDA BPMS</h3>
              <p className="text-xs text-gray-500">Access archived permits directly from your phone's home screen.</p>
            </div>

            {/* iOS Safari Guide */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-2 text-xs text-blue-900">
              <p className="font-bold border-b border-blue-200 pb-1">iPhone / iOS (Safari):</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Tap the <strong>Share button</strong> (square with up arrow).</li>
                <li>Scroll down and select <strong>"Add to Home Screen"</strong>.</li>
                <li>Tap <strong>Add</strong> at the top right.</li>
              </ol>
            </div>

            {/* Android / Chrome Guide */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2 text-xs text-gray-800">
              <p className="font-bold border-b border-gray-200 pb-1">Android / Chrome:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Tap the <strong>3 dots menu</strong> (top right).</li>
                <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
              </ol>
            </div>

            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-md hover:bg-blue-700 text-xs transition cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Sidebar;