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
// 1. DYNAMIC DRIVE FOLDER & UPLOAD SESSION ROUTE
// ==========================================
router.post('/get-drive-upload-url', requireAuth, async (req, res) => {
  try {
    const { permitNumber, category, fileName, mimeType, fileSize } = req.body;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientId || !clientSecret || !refreshToken || !rootFolderId) {
      console.error('❌ Missing Google OAuth keys or GOOGLE_DRIVE_FOLDER_ID in Render Environment.');
      return res.status(500).json({ 
        success: false, 
        message: 'Server Configuration Error: Google OAuth keys missing on Render.' 
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Helper: Search for existing folder or create new one
    const getOrCreateFolder = async (folderName, parentId) => {
      const safeName = folderName.replace(/'/g, "\\'");
      const q = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and '${parentId}' in parents and trashed=false`;
      
      const searchRes = await drive.files.list({ q, fields: 'files(id, name)' });
      if (searchRes.data.files && searchRes.data.files.length > 0) {
        return searchRes.data.files[0].id;
      }

      const createRes = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        },
        fields: 'id'
      });

      return createRes.data.id;
    };

    // A. Get or Create Master Permit Folder (e.g. NIPDA-PRAM-26-29)
    const cleanPermitNum = permitNumber ? permitNumber.replace(/\//g, '-') : 'UNASSIGNED-PERMIT';
    const permitFolderId = await getOrCreateFolder(cleanPermitNum, rootFolderId);

    // B. Get or Create Category Subfolder
    const categoryMap = {
      certificate: '1. Permit Certificates',
      drawings: '2. Architectural Drawings',
      permitForm: '3. Permit Forms',
      receipts: '4. Receipts & Bills'
    };
    const subfolderName = categoryMap[category] || '5. Misc Documents';
    const targetFolderId = await getOrCreateFolder(subfolderName, permitFolderId);

    // C. Get Access Token for Resumable Session
    const tokenResponse = await oauth2Client.getAccessToken();
    const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;

    const clientOrigin = req.headers.origin || req.headers.referer || '*';

    // D. Request Resumable Session inside the Category Subfolder
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
        parents: [targetFolderId]
      })
    });

    const uploadUrl = googleRes.headers.get('location');

    if (!uploadUrl) {
      const errText = await googleRes.text();
      console.error('Google Drive session creation failed:', errText);
      return res.status(500).json({ 
        success: false, 
        message: 'Google Drive rejected upload session creation.' 
      });
    }

    res.json({ success: true, uploadUrl });
  } catch (err) {
    console.error('Error generating Google Drive folder structure & session:', err);
    res.status(500).json({ 
      success: false, 
      message: `Google Drive Folder Error: ${err.message}` 
    });
  }
});

// ==========================================
// 2. METADATA SAVER ROUTE
// ==========================================
router.post('/archive-metadata', requireAuth, async (req, res) => {
  try {
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

    const dbResponse = await db.query(query, values);
    const rows = Array.isArray(dbResponse) ? dbResponse : (dbResponse && dbResponse.rows ? dbResponse.rows : []);
    const savedRecord = rows.length > 0 ? rows[0] : null;

    // Sync into 'permits' table
    try {
      const syncQuery = `
        INSERT INTO permits 
        (permit_number, date_issued, purpose, applicant_name, phone, location, address, certificate_link, drawings_links, permit_form_link, receipts_links)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `;
      await db.query(syncQuery, values);
    } catch (syncErr) {
      console.log("Sync to permits table notice:", syncErr.message);
    }

    res.json({ success: true, data: savedRecord });
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