const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getPermitStats, getMonthlyStats, getPermits, archivePermit } = require('../controllers/permitController');

// THE MAGIC UPGRADE: Hold files in invisible RAM instead of saving to the hard drive!
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ENTERPRISE UPGRADE: Swap sitePlan for indenture, increase array limits
const archivalUploads = upload.fields([
  { name: 'certificate', maxCount: 1 }, 
  { name: 'drawings', maxCount: 20 },     // Array: Up to 20 drawings
  { name: 'indenture', maxCount: 1 },     // Replaced sitePlan
  { name: 'receipts', maxCount: 10 },     // Array: Up to 10 receipts
  { name: 'geoReference', maxCount: 1 }
]);

router.get('/stats', getPermitStats);
router.get('/monthly-stats', getMonthlyStats); 
router.get('/', getPermits);
router.post('/archive', archivalUploads, archivePermit);

module.exports = router;