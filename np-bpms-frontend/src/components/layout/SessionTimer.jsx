import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SessionTimer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  const isLoggedIn = Boolean(token && user);

  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setTimeLeft(null);
      return;
    }

    // Read or initialize 12-hour expiration timestamp
    let expiryTime = localStorage.getItem('token_expiry');
    if (!expiryTime) {
      expiryTime = Date.now() + 12 * 60 * 60 * 1000;
      localStorage.setItem('token_expiry', expiryTime.toString());
    } else {
      expiryTime = parseInt(expiryTime, 10);
    }

    const updateCountdown = () => {
      const now = Date.now();
      const diff = expiryTime - now;

      if (diff <= 0) {
        // --- SESSION EXPIRED: AUTO LOGOUT ---
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('token_expiry');
        setTimeLeft(null);
        alert("Your 12-hour officer session has expired. Please log in again.");
        navigate('/vault-admin');
      } else {
        // Format remaining milliseconds to HH:MM:SS
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const pad = (num) => String(num).padStart(2, '0');
        setTimeLeft(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [isLoggedIn, location, navigate]);

  if (!isLoggedIn || !timeLeft) return null;

  return (
    <div className="w-full bg-white border-b border-gray-200 px-8 py-3 flex justify-between items-center text-xs shadow-xs">
      <div className="flex items-center space-x-2 text-gray-500 font-medium">
        <span>Protected Officer Session</span>
        <span className="text-gray-300">•</span>
        <span className="text-gray-800 font-semibold">{user?.name} ({user?.email})</span>
      </div>

      {/* Top Right Live Countdown Badge */}
      <div className="flex items-center space-x-2 bg-amber-50 text-amber-900 border border-amber-200 px-3.5 py-1.5 rounded-full font-bold shadow-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span className="tracking-wide">Session Expires in: <span className="font-mono text-amber-950 font-extrabold">{timeLeft}</span></span>
      </div>
    </div>
  );
};

export default SessionTimer;