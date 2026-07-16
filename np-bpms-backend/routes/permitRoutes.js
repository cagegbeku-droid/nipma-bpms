const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getPermitStats, getMonthlyStats, getPermits, archivePermit } = require('../controllers/permitController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const archivalUploads = upload.fields([
  { name: 'certificate', maxCount: 1 }, { name: 'drawings', maxCount: 1 },
  { name: 'sitePlan', maxCount: 1 }, { name: 'permitForm', maxCount: 1 },
  { name: 'receipts', maxCount: 1 }, { name: 'jacket', maxCount: 1 },
  { name: 'indenture', maxCount: 1 }, { name: 'geoReference', maxCount: 1 }
]);

router.get('/stats', getPermitStats);
router.get('/monthly-stats', getMonthlyStats); // <-- New Chart Route
router.get('/', getPermits);
router.post('/archive', archivalUploads, archivePermit);

module.exports = router;