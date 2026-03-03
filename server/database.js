const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function openDb() {
  return open({
    filename: './protoMain.db',
    driver: sqlite3.Database
  });
}

async function initDb() {
  const db = await openDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at DATETIME DEFAULT NULL,
      status TEXT DEFAULT 'approved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Try to add role column if it doesn't exist (for existing databases)
    -- SQLite doesn't support IF NOT EXISTS in ALTER TABLE, so we handle it gracefully
    `);

  try {
    await db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'`);
  } catch (e) {
    // Column probably already exists, ignore error
  }
  // Add profile_image column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN profile_image TEXT`);
  } catch (e) {
    // Column probably already exists, ignore error
  }
  // Add is_deleted column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT 0`);
  } catch (e) {
    // Column probably already exists, ignore error
  }
  // Add deleted_at column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL`);
  } catch (e) {
    // Column probably already exists, ignore error
  }
  // Add status column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'approved'`);
  } catch (e) {
    // Column probably already exists, ignore error
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS labours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      password_hash TEXT,
      aadhaar TEXT,
      site TEXT,
      site_id INTEGER REFERENCES sites(id),
      rate REAL,
      notes TEXT,
      trade TEXT,
      date_of_birth TEXT,
      emergency_phone TEXT,
      status TEXT DEFAULT 'active',
      profile_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add site_id column if it doesn't exist (for existing databases)
  try {
    await db.exec(`ALTER TABLE labours ADD COLUMN site_id INTEGER REFERENCES sites(id)`);
  } catch (e) {
    // Column probably already exists, ignore error
  }

  // Add status column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE labours ADD COLUMN status TEXT DEFAULT 'active'`);
  } catch (e) {
    // Column probably already exists, ignore error
  }

  // Add password_hash column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE labours ADD COLUMN password_hash TEXT`);
  } catch (e) {
    // Column probably already exists, ignore error
  }

  // Add profile_image column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE labours ADD COLUMN profile_image TEXT`);
  } catch (e) {
    // Column probably already exists, ignore error
  }

  // Add date_of_birth column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE labours ADD COLUMN date_of_birth TEXT`);
  } catch (e) {
    // Column probably already exists, ignore error
  }

  // Add emergency_phone column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE labours ADD COLUMN emergency_phone TEXT`);
  } catch (e) {
    // Column probably already exists, ignore error
  }

  // Add trade column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE labours ADD COLUMN trade TEXT`);
  } catch (e) {
    // Column probably already exists, ignore error
  }

  // Sites table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      description TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Junction table for site-supervisor assignments
  await db.exec(`
    CREATE TABLE IF NOT EXISTS site_supervisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      supervisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_id, supervisor_id)
    );
  `);

  // Attendance table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      labour_id INTEGER NOT NULL REFERENCES labours(id),
      site_id INTEGER NOT NULL REFERENCES sites(id),
      supervisor_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      status TEXT CHECK(status IN ('full', 'half', 'absent')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(labour_id, date)
    );

    -- Daily Site Attendance Status table
    CREATE TABLE IF NOT EXISTS daily_site_attendance_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      date TEXT NOT NULL,
      is_locked BOOLEAN DEFAULT 0,
      food_provided BOOLEAN DEFAULT 0,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      UNIQUE(site_id, date)
    );
  `);

  // Try to add food_provided column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE daily_site_attendance_status ADD COLUMN food_provided BOOLEAN DEFAULT 0`);
  } catch (e) {
    // Column probably already exists
  }

  await db.exec(`
    -- Advances table
    CREATE TABLE IF NOT EXISTS advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Refresh Tokens table
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked BOOLEAN DEFAULT 0
    );

    -- Overtime table
    CREATE TABLE IF NOT EXISTS overtime (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        hours REAL NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Labour Refresh Tokens table
    CREATE TABLE IF NOT EXISTS labour_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked BOOLEAN DEFAULT 0
    );

    -- Complaints table
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      labour_id INTEGER REFERENCES labours(id) ON DELETE CASCADE,
      complaint TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Salary Payments table
    CREATE TABLE IF NOT EXISTS salary_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      month_reference TEXT NOT NULL,
      payment_method TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Search Indexes
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_labours_name ON labours(name);
    CREATE INDEX IF NOT EXISTS idx_labours_phone ON labours(phone);
    CREATE INDEX IF NOT EXISTS idx_labours_trade ON labours(trade);
    
    CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    
    CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name);
  `);

  console.log('Database initialized.');
  return db;
}

module.exports = { openDb, initDb };
