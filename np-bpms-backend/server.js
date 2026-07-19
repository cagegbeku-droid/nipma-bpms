require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Static Folder for Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import Routes
const permitRoutes = require('./routes/permitRoutes');
const { triggerBackup } = require('./controllers/backupController'); 

// Use Routes
app.use('/api/permits', permitRoutes);
app.get('/api/backup', triggerBackup); // Your hidden backup route!

app.get('/', (req, res) => {
  res.send('NP-BPMS Archival API is running');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});