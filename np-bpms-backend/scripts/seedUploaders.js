require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Add as many staff accounts as you need here
const staffAccounts = [
  { name: 'Engineering Officer 1', email: 'staff1@nipda.gov.gh' },
  { name: 'Engineering Officer 2', email: 'staff2@nipda.gov.gh' }
];

const sharedPassword = 'engineersunit';

const seed = async () => {
  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(sharedPassword, salt);

    for (const staff of staffAccounts) {
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, 'uploader')
         ON CONFLICT (email) DO UPDATE 
         SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
        [staff.name, staff.email.toLowerCase().trim(), passwordHash]
      );
      console.log(`✅ Seeded account: ${staff.email}`);
    }
  } catch (err) {
    console.error('Error seeding staff accounts:', err);
  } finally {
    await pool.end();
  }
};

seed();