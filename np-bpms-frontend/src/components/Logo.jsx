import React from 'react';

const Logo = ({ size = 'md', showText = true, textColor = 'text-white', subtitleColor = 'text-blue-200' }) => {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
    xl: 'h-28 w-28'
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`relative shrink-0 ${sizeMap[size] || sizeMap.md} rounded-xl overflow-hidden shadow-md bg-slate-900 border border-slate-700/60 p-0.5 flex items-center justify-center`}>
        <img
          src="/nipma-bpms-logo.svg"
          alt="NiPMA BPMS Emblem"
          className="w-full h-full object-contain"
        />
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <span className={`text-sm md:text-base font-extrabold tracking-wider uppercase leading-tight ${textColor}`}>
            NiPMA BPMS
          </span>
          <span className={`text-[10px] md:text-xs font-semibold tracking-wide uppercase ${subtitleColor}`}>
            Building Permit Records
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
