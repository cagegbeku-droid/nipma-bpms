import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = ({ onLoginSuccess }) => {
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
        // 1. Save authentication token, user data, and 12-hour expiration timestamp
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        const twelveHoursFromNow = Date.now() + 12 * 60 * 60 * 1000;
        localStorage.setItem('token_expiry', twelveHoursFromNow.toString());
        
        // 2. Handle state update or navigation
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        } else {
          navigate('/');
        }
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
      <div className="bg-white p-8 rounded-xl shadow-md w-96 max-w-full border border-gray-200 text-center">
        
        {/* Official Portal Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 leading-snug">
            NIPDA BPMS<br/>Officer Archive Portal
          </h2>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200 font-medium text-left">
            {error}
          </div>
        )}
        
        {/* Form Fields */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Official Email
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              placeholder="staff1@nipda.gov.gh" 
              className="w-full p-3 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-600 text-sm" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Password
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              placeholder="••••••••" 
              className="w-full p-3 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-600 text-sm" 
            />
          </div>

          {/* Action Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-md hover:bg-blue-700 transition text-sm flex items-center justify-center space-x-2 disabled:opacity-70 cursor-pointer shadow-sm"
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
              <span>Log In to Archive System</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;