import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'supersecret123') {
      // 1. Save the key to memory
      localStorage.setItem('x-admin-key', password);
      // 2. Teleport you back to the main page (which will now be unlocked!)
      navigate('/'); 
    } else {
      setError('Invalid credentials.');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-96 max-w-full text-center border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-6">System Administration</h2>
        
        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            placeholder="Enter Admin Passcode" 
            className="w-full p-3 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-gray-800" 
          />
          <button type="submit" className="w-full bg-gray-900 text-white font-semibold py-3 rounded-md hover:bg-black transition">
            Authorize
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;