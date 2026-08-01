require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

const app = express();

// --- CORS CONFIGURATION ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- INCREASED BODY LIMITS FOR HEAVY PAYLOADS ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Folder for Local Backups/Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import Routes
const permitRoutes = require('./routes/permitRoutes');
const authRoutes = require('./routes/auth');
const { triggerBackup } = require('./controllers/backupController'); 

// --- HEALTH CHECK ENDPOINT (For Keep-Alive Pings) ---
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'NIPDA BPMS Archival API is active and healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mount Routes
app.use('/api/permits', permitRoutes);
app.use('/api/auth', authRoutes);
app.get('/api/backup', triggerBackup);

app.get('/', (req, res) => {
  res.send('NP-BPMS Archival API is running');
});

// ==========================================
// GLOBAL ERROR HANDLING MIDDLEWARE
// ==========================================
app.use((err, req, res, next) => {
  // Handle aborted request streams from Multer cleanly when client cancels
  if (err.message === 'Request aborted' || err.code === 'ECONNABORTED') {
    console.warn('⚠️ Notice: Client closed upload stream before completion.');
    return res.status(499).json({ 
      success: false, 
      message: 'Upload stream was interrupted or aborted by client.' 
    });
  }

  // Handle Multer file limit errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      success: false, 
      message: 'File size exceeds allowed upload limit.' 
    });
  }

  console.error('Unhandled Server Error:', err);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal server error.' 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});