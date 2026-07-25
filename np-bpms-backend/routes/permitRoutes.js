const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const db = require('../config/db');

// Imports ALL 7 original controller functions
const { 
  getPermitStats, 
  getMonthlyStats, 
  getPermits, 
  archivePermit, 
  deletePermit, 
  updatePermit, 
  removePermitFile 
} = require('../controllers/permitController');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const archivalUploads = upload.fields([
  { name: 'certificate', maxCount: 1 }, 
  { name: 'drawings', maxCount: 100 },
  { name: 'permitForm', maxCount: 20 },
  { name: 'receipts', maxCount: 10 }
]);

// --- AUTO-CREATE DATABASE TABLES IF MISSING ---
const ensureTablesExist = async () => {
  const createHistoricalPermitsTable = `
    CREATE TABLE IF NOT EXISTS historical_permits (
      id SERIAL PRIMARY KEY,
      permit_number VARCHAR(255) NOT NULL,
      date_issued DATE,
      purpose VARCHAR(255),
      applicant_name VARCHAR(255),
      phone VARCHAR(100),
      location VARCHAR(255),
      address TEXT,
      certificate_link TEXT,
      drawings_links TEXT,
      permit_form_link TEXT,
      receipts_links TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createPermitsTable = `
    CREATE TABLE IF NOT EXISTS permits (
      id SERIAL PRIMARY KEY,
      permit_number VARCHAR(255) NOT NULL,
      date_issued DATE,
      purpose VARCHAR(255),
      applicant_name VARCHAR(255),
      phone VARCHAR(100),
      location VARCHAR(255),
      address TEXT,
      certificate_link TEXT,
      drawings_links TEXT,
      permit_form_link TEXT,
      receipts_links TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await db.query(createHistoricalPermitsTable);
    await db.query(createPermitsTable);
  } catch (err) {
    console.error("Error ensuring database tables exist:", err);
  }
};

// --- JWT OFFICER AUTHENTICATION MIDDLEWARE ---
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nipda_secret_key_2026');
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized: Invalid or expired session token. Please log in again." 
      });
    }
  }

  return res.status(401).json({ 
    success: false, 
    message: "Unauthorized: Officer session token required." 
  });
};

// ==========================================
// 1. DIRECT GOOGLE DRIVE UPLOAD SESSION ROUTE
// ==========================================
router.post('/get-drive-upload-url', requireAuth, async (req, res) => {
  try {
    const { fileName, mimeType, fileSize } = req.body;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientId || !clientSecret || !refreshToken) {
      console.error('❌ Missing Google OAuth keys in Render Environment.');
      return res.status(500).json({ 
        success: false, 
        message: 'Server Configuration Error: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN missing.' 
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const tokenResponse = await oauth2Client.getAccessToken();
    const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;

    if (!accessToken) {
      throw new Error("Could not retrieve access token from Google OAuth2 client.");
    }

    const clientOrigin = req.headers.origin || req.headers.referer || '*';

    const googleRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType || 'application/pdf',
        'X-Upload-Content-Length': fileSize ? String(fileSize) : undefined,
        'Origin': clientOrigin
      },
      body: JSON.stringify({
        name: `${Date.now()}-${fileName}`,
        parents: folderId ? [folderId] : []
      })
    });

    const uploadUrl = googleRes.headers.get('location');

    if (!uploadUrl) {
      const errText = await googleRes.text();
      console.error('Google Drive session creation failed:', errText);
      return res.status(500).json({ 
        success: false, 
        message: 'Google Drive rejected upload session creation. Check server logs.' 
      });
    }

    res.json({ success: true, uploadUrl });
  } catch (err) {
    console.error('Error generating Google Drive session:', err);
    res.status(500).json({ 
      success: false, 
      message: `Google Drive Session Error: ${err.message || 'Authentication failed'}` 
    });
  }
});

// ==========================================
// 2. METADATA SAVER ROUTE (AUTO-CREATES TABLE IF MISSING)
// ==========================================
router.post('/archive-metadata', requireAuth, async (req, res) => {
  try {
    // Ensure table exists in PostgreSQL before executing INSERT
    await ensureTablesExist();

    const { 
      permitNumber, dateIssued, purpose, applicantName, 
      phone, location, address, certificateLink, 
      drawingsLinks, permitFormLink, receiptsLinks 
    } = req.body;

    const query = `
      INSERT INTO historical_permits 
      (permit_number, date_issued, purpose, applicant_name, phone, location, address, certificate_link, drawings_links, permit_form_link, receipts_links)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    
    const values = [
      permitNumber, 
      dateIssued, 
      purpose, 
      applicantName, 
      phone || null, 
      location, 
      address, 
      certificateLink || null, 
      drawingsLinks || null, 
      permitFormLink || null, 
      receiptsLinks || null
    ];

    const { rows } = await db.query(query, values);

    // Also insert into 'permits' table so existing GET routes display the record
    try {
      const syncQuery = `
        INSERT INTO permits 
        (permit_number, date_issued, purpose, applicant_name, phone, location, address, certificate_link, drawings_links, permit_form_link, receipts_links)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `;
      await db.query(syncQuery, values);
    } catch (syncErr) {
      // Ignore if permits table schema differs slightly
      console.log("Sync to permits table notice:", syncErr.message);
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Database metadata insert error:", err);
    res.status(500).json({ 
      success: false, 
      message: `Database Insert Error: ${err.message}` 
    });
  }
});

// ==========================================
// PUBLIC ROUTES
// ==========================================
router.get('/stats', getPermitStats);
router.get('/monthly-stats', getMonthlyStats); 
router.get('/', getPermits);

// ==========================================
// PROTECTED ROUTES
// ==========================================
router.post('/archive', requireAuth, archivalUploads, archivePermit);
router.delete('/:id', requireAuth, deletePermit);
router.put('/:id', requireAuth, updatePermit);
router.put('/:id/remove-file', requireAuth, removePermitFile);

module.exports = router;