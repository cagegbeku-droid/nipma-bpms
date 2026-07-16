const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let dbInstance = null;

async function setupDatabase() {
  // Opens (or creates) a local file called 'np_bpms.db'
  const db = await open({
    filename: './np_bpms.db',
    driver: sqlite3.Database
  });

  // Automatically build the tables if they don't exist yet
  await db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT,
        last_name TEXT,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role_id INTEGER,
        department TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS applicants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        email TEXT,
        id_type TEXT,
        id_number TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plot_number TEXT,
        community TEXT,
        electoral_area TEXT,
        building_type TEXT,
        gps_address TEXT
    );

    CREATE TABLE IF NOT EXISTS permits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        permit_number TEXT UNIQUE NOT NULL,
        applicant_id INTEGER,
        property_id INTEGER,
        status TEXT DEFAULT 'PENDING',
        is_historical BOOLEAN DEFAULT 0,
        application_year INTEGER,
        assigned_officer_id INTEGER,
        qr_code_hash TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES applicants(id),
        FOREIGN KEY (property_id) REFERENCES properties(id),
        FOREIGN KEY (assigned_officer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        permit_id INTEGER,
        document_type TEXT,
        file_path TEXT NOT NULL,
        uploaded_by INTEGER,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (permit_id) REFERENCES permits(id),
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    -- Insert roles if they don't exist
    INSERT OR IGNORE INTO roles (name) VALUES ('Admin'), ('Works'), ('Planning'), ('Finance');
  `);

  console.log('Successfully connected to SQLite Database and verified tables.');
  dbInstance = db;
}

setupDatabase();

// Export a wrapper that mimics the MySQL pool.query syntax so we don't have to change our controllers
module.exports = {
  query: async (sql, params) => {
    if (!dbInstance) throw new Error("Database not initialized yet");
    
    // Convert MySQL '?' to SQLite syntax if needed, though SQLite also accepts '?'
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const rows = await dbInstance.all(sql, params);
      return [rows];
    } else {
      const result = await dbInstance.run(sql, params);
      // Mocking MySQL's result object structure
      return [{ insertId: result.lastID, affectedRows: result.changes }];
    }
  },
  getConnection: async () => {
     // Mocking transaction connections for SQLite
     if (!dbInstance) throw new Error("Database not initialized yet");
     return {
        beginTransaction: async () => await dbInstance.run('BEGIN TRANSACTION'),
        query: async (sql, params) => {
           if (sql.trim().toUpperCase().startsWith('SELECT')) {
             const rows = await dbInstance.all(sql, params);
             return [rows];
           } else {
             const result = await dbInstance.run(sql, params);
             return [{ insertId: result.lastID, affectedRows: result.changes }];
           }
        },
        commit: async () => await dbInstance.run('COMMIT'),
        rollback: async () => await dbInstance.run('ROLLBACK'),
        release: () => {} 
     };
  }
};