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
    const { fileName, mimeType } = req.body;

    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const googleRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType || 'application/pdf'
      },
      body: JSON.stringify({
        name: `${Date.now()}-${fileName}`,
        parents: folderId ? [folderId] : []
      })
    });

    const uploadUrl = googleRes.headers.get('location');

    if (!uploadUrl) {
      return res.status(500).json({ success: false, message: 'Failed to generate Google Drive upload session.' });
    }

    res.json({ success: true, uploadUrl });
  } catch (err) {
    console.error('Error generating Google Drive session:', err);
    res.status(500).json({ success: false, message: 'Server error creating Google Drive upload session.' });
  }
});

// ==========================================
// 2. METADATA SAVER ROUTE
// ==========================================
router.post('/archive-metadata', requireAuth, async (req, res) => {
  try {
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

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Database metadata insert error:", err);
    res.status(500).json({ success: false, message: "Failed to save record to database." });
  }
});

// ==========================================
// PUBLIC ROUTES (Anyone can view records)
// ==========================================
router.get('/stats', getPermitStats);
router.get('/monthly-stats', getMonthlyStats); 
router.get('/', getPermits);

// ==========================================
// PROTECTED ROUTES (Logged-in Officers Only)
// ==========================================
router.post('/archive', requireAuth, archivalUploads, archivePermit);
router.delete('/:id', requireAuth, deletePermit);
router.put('/:id', requireAuth, updatePermit);
router.put('/:id/remove-file', requireAuth, removePermitFile);

module.exports = router;