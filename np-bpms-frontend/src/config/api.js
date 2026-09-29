// Centralized API Base URL
// In development or production on Vercel, set VITE_API_URL in environment settings
// e.g. VITE_API_URL=https://nipma-bpms-backend-xxxxxx.a.run.app
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://nipma-bpms-backend.onrender.com';
