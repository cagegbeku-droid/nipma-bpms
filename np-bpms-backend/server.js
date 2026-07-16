require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // <-- ADD THIS LINE
const db = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --> ADD THIS LINE TO UNLOCK THE VAULT <--
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import Routes
const permitRoutes = require('./routes/permitRoutes');

// Use Routes
app.use('/api/permits', permitRoutes);

app.get('/', (req, res) => {
  res.send('NP-BPMS Archival API is running');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});