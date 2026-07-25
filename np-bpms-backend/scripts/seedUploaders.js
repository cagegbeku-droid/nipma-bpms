require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const seed = async () => {
  const uploaders = [
    { name: 'Officer One', email: 'officer1@nipda.gov.gh', password: 'Password2026!' },
    { name: 'Officer Two', email: 'officer2@nipda.gov.gh', password: 'Password2026!' }
  ];

  for (const officer of uploaders) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(officer.password, salt);

    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, 'uploader')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [officer.name, officer.email, hash]
    );
    console.log(`✅ Seeded uploader: ${officer.email}`);
  }

  pool.end();
};

seed().catch(console.error);
