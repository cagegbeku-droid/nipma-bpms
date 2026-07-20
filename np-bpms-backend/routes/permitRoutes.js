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

router.get('/stats', getPermitStats);
router.get('/monthly-stats', getMonthlyStats); 
router.get('/', getPermits);
router.post('/archive', archivalUploads, archivePermit);
router.delete('/:id', deletePermit);
router.put('/:id', updatePermit);
router.put('/:id/remove-file', removePermitFile);

module.exports = router;