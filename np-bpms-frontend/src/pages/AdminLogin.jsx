import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch("https://nipma-bpms-backend.onrender.com/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 1. Save the JWT token and user profile to localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // 2. Redirect to main unlocked view
        navigate('/'); 
      } else {
        setError(data.message || 'Invalid email or password.');
      }
    } catch (err) {
      setError('Server connection error. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-96 max-w-full border border-gray-200">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">System Administration</h2>
          <p className="text-xs text-gray-500 mt-1">NIPDA BPMS Officer Portal</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200 font-medium">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Official Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              placeholder="officer1@nipda.gov.gh" 
              className="w-full p-3 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-gray-800 text-sm" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              placeholder="••••••••" 
              className="w-full p-3 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-gray-800 text-sm" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gray-900 text-white font-semibold py-3 rounded-md hover:bg-black transition text-sm flex items-center justify-center space-x-2 disabled:opacity-70 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Authorize Officer</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;