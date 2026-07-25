require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

const app = express();

// --- UPDATED CORS MIDDLEWARE ---
app.use(cors({
  origin: '*', // Allows frontend connection from Vercel, Netlify, localhost
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));

// INCREASED BODY PARSER LIMIT FOR LARGE METADATA PAYLOADS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Folder for Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import Routes
const permitRoutes = require('./routes/permitRoutes');
const authRoutes = require('./routes/auth'); // Handles /api/auth/login
const { triggerBackup } = require('./controllers/backupController'); 

// Use Routes
app.use('/api/permits', permitRoutes);
app.use('/api/auth', authRoutes);
app.get('/api/backup', triggerBackup);

app.get('/', (req, res) => {
  res.send('NP-BPMS Archival API is running');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});