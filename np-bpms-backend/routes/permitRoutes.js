const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getPermitStats, getMonthlyStats, getPermits, archivePermit, deletePermit } = require('../controllers/permitController');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const archivalUploads = upload.fields([
  { name: 'certificate', maxCount: 1 }, 
  { name: 'drawings', maxCount: 100 },
  { name: 'permitForm', maxCount: 20 },
  { name: 'receipts', maxCount: 10 }
]);

router.get('/stats', getPermitStats);
router.get('/monthly-stats', getMonthlyStats); 
router.get('/', getPermits);
router.post('/archive', archivalUploads, archivePermit);

// NEW: The Delete Route
router.delete('/:id', deletePermit);

module.exports = router;