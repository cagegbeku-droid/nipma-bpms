const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getPermitStats, getMonthlyStats, getPermits, archivePermit } = require('../controllers/permitController');

// THE MAGIC UPGRADE: Hold files in invisible RAM instead of saving to the hard drive!
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const archivalUploads = upload.fields([
  { name: 'certificate', maxCount: 1 }, { name: 'drawings', maxCount: 1 },
  { name: 'sitePlan', maxCount: 1 }, { name: 'permitForm', maxCount: 1 },
  { name: 'receipts', maxCount: 1 }, { name: 'jacket', maxCount: 1 },
  { name: 'indenture', maxCount: 1 }, { name: 'geoReference', maxCount: 1 }
]);

router.get('/stats', getPermitStats);
router.get('/monthly-stats', getMonthlyStats); 
router.get('/', getPermits);
router.post('/archive', archivalUploads, archivePermit);

module.exports = router;