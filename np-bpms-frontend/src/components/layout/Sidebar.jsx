
import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, ArrowUpTrayIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline'; 

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Upload Archive', href: '/permits/new', icon: ArrowUpTrayIcon },
  { name: 'Registry', href: '/permits/historical', icon: ArchiveBoxIcon },
];

const Sidebar = () => {
  return (
    <div className="flex flex-col w-64 bg-gray-900 text-white">
      <div className="flex flex-col items-center justify-center py-6 border-b border-gray-800">
        {/* The Official NiPMA Logo */}
        <img 
          src="/465783232_1385047576154895_1881211722468502227_n.jpg" 
          alt="NiPMA Logo" 
          className="h-24 w-24 rounded-full bg-white object-contain mb-4 p-1 shadow-md" 
        />
        
        {/* The Official Assembly Name */}
        <h1 className="text-sm font-bold tracking-wider text-center px-4 text-blue-400 leading-snug">
          NINGO-PRAMPRAM<br/>MUNICIPAL ASSEMBLY
        </h1>
        <p className="text-xs text-gray-400 mt-2 font-medium tracking-widest">NiPMA ARCHIVES</p>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors " +
                (isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white")
              }
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
