import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, ArrowUpTrayIcon, ArchiveBoxIcon, LockClosedIcon } from '@heroicons/react/24/outline'; 

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Upload Archive', href: '/permits/new', icon: ArrowUpTrayIcon },
  { name: 'Registry', href: '/permits/historical', icon: ArchiveBoxIcon },
];

const Sidebar = () => {
  // --- INVISIBLE ADMIN CHECK ---
  const isAdmin = localStorage.getItem('x-admin-key') === 'supersecret123';

  // Automatically hide the "Upload Archive" link from the public
  const filteredNavigation = navigation.filter((item) => {
    if (!isAdmin && item.name === 'Upload Archive') {
      return false; // Hide it!
    }
    return true; // Show everything else
  });

  const handleLogout = () => {
    localStorage.removeItem('x-admin-key');
    window.location.reload(); // Refresh the page to lock the doors
  };

  return (
    <div className="flex flex-col w-full md:w-64 bg-gray-900 text-white shrink-0 md:min-h-screen">
      
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

      <div className="overflow-x-auto md:overflow-y-auto py-2 md:py-4 flex-1 flex flex-col justify-between">
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

        {/* --- SECRET ADMIN LOGOUT BUTTON --- */}
        {isAdmin && (
          <div className="px-2 mt-4 md:mt-auto border-t border-gray-800 pt-4 hidden md:block">
            <button
              onClick={handleLogout}
              className="group flex w-full items-center px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap text-red-400 hover:bg-red-500 hover:text-white"
            >
              <LockClosedIcon className="mr-2 md:mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              Lock System
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default Sidebar;