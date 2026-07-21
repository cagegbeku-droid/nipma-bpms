const express = require('express');
const router = express.Router();
const multer = require('multer');

// Imports ALL 7 functions from the controller
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

// --- ADMIN SECURITY MIDDLEWARE ---
const requireAdmin = (req, res, next) => {
  const apiKey = req.headers['x-admin-key'];
  // This must match the password you set in your React frontend!
  if (apiKey === 'supersecret123') {
    next(); // Passcode correct, allow the action
  } else {
    res.status(403).json({ success: false, message: "Forbidden: Admin access required." });
  }
};

// ==========================================
// PUBLIC ROUTES (Viewers can access without password)
// ==========================================
router.get('/stats', getPermitStats);
router.get('/monthly-stats', getMonthlyStats); 
router.get('/', getPermits);

// ==========================================
// PROTECTED ROUTES (Requires Admin Passcode)
// ==========================================
// ENGINEER TWEAK: requireAdmin now runs BEFORE archivalUploads.
// This blocks unauthorized users instantly before parsing their files.
router.post('/archive', requireAdmin, archivalUploads, archivePermit);
router.delete('/:id', requireAdmin, deletePermit);
router.put('/:id', requireAdmin, updatePermit);
router.put('/:id/remove-file', requireAdmin, removePermitFile);

module.exports = router;