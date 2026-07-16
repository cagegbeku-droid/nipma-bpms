const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to your existing database file
const dbPath = path.join(__dirname, 'config', 'npda.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("Dropping old tables...");
  db.run(`DROP TABLE IF EXISTS permits`);
  db.run(`DROP TABLE IF EXISTS properties`);
  db.run(`DROP TABLE IF EXISTS applicants`);

  console.log("Creating new Applicants table...");
  db.run(`
    CREATE TABLE applicants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT NOT NULL
    )
  `);

  console.log("Creating new Properties table...");
  db.run(`
    CREATE TABLE properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot_number TEXT NOT NULL,
      community TEXT NOT NULL,
      building_type TEXT NOT NULL
    )
  `);

  console.log("Creating new Archival Permits table with Document Vault...");
  db.run(`
    CREATE TABLE permits (
      permit_number TEXT PRIMARY KEY,
      applicant_id INTEGER,
      property_id INTEGER,
      
      -- Metadata
      date_issued TEXT,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      -- The Document Vault (Stores File Paths)
      file_permit_certificate TEXT,
      file_architectural_drawings TEXT,
      file_site_plan TEXT,
      file_permit_form TEXT,
      file_receipts TEXT,
      file_jacket TEXT,
      file_indenture TEXT,
      file_geo_reference TEXT,
      
      FOREIGN KEY (applicant_id) REFERENCES applicants (id),
      FOREIGN KEY (property_id) REFERENCES properties (id)
    )
  `, (err) => {
    if (err) console.error(err);
    else console.log("SUCCESS: Archival Database rebuilt perfectly!");
    db.close();
  });
});