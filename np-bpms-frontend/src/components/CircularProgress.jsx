import React from 'react';

const CircularProgress = ({
  progress = 0,
  size = 32,
  strokeWidth = 3,
  color = '#2563eb',
  bgColor = '#e2e8f0',
  textColor,
  showText = true,
  className = ''
}) => {
  const safeProgress = Math.min(Math.max(Number(progress) || 0, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

  const fontPx = Math.max(8, Math.round(size * 0.32));

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={`${Math.round(safeProgress)}%`}
    >
      <svg className="transform -rotate-90 block" width={size} height={size}>
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Progress fill ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={safeProgress >= 100 ? '#10b981' : color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      {showText && (
        <span
          className="absolute font-black select-none leading-none tracking-tighter"
          style={{
            fontSize: `${fontPx}px`,
            color: textColor || (safeProgress >= 100 ? '#10b981' : color)
          }}
        >
          {safeProgress >= 100 ? '✓' : `${Math.round(safeProgress)}%`}
        </span>
      )}
    </div>
  );
};

export default CircularProgress;
