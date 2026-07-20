const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getPermitStats, getMonthlyStats, getPermits, archivePermit } = require('../controllers/permitController');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const archivalUploads = upload.fields([
  { name: 'certificate', maxCount: 1 }, 
  { name: 'drawings', maxCount: 100 },
  { name: 'permitForm', maxCount: 20 },
  { name: 'receipts', maxCount: 10 }
  // geoReference is completely removed
]);

router.get('/stats', getPermitStats);
router.get('/monthly-stats', getMonthlyStats); 
router.get('/', getPermits);
router.post('/archive', archivalUploads, archivePermit);

module.exports = router;