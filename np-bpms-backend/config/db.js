const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for secure cloud connections
  }
});

// We wrap it like this so your controller code continues to work seamlessly
module.exports = {
  query: async (text, params) => {
    const result = await pool.query(text, params);
    return [result.rows]; 
  }
};