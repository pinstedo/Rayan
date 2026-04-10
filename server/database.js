const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/proto',
});

// A wrapper to translate SQLite `?` to PostgreSQL `$1, $2, ...`
function _convertQuery(sql) {
  let i = 1;
  // Simple replacement of ? outside of strings (this simplistic regex assumes no ? in literal strings)
  return sql.replace(/\?/g, () => `$${i++}`);
}

class DatabaseWrapper {
  constructor(client) {
    this.client = client;
  }

  async all(sql, params = []) {
    const res = await this.client.query(_convertQuery(sql), params);
    return res.rows;
  }

  async get(sql, params = []) {
    const res = await this.client.query(_convertQuery(sql), params);
    return res.rows[0];
  }

  async run(sql, params = []) {
    const res = await this.client.query(_convertQuery(sql), params);
    // Mimic sqlite result for lastID if available via RETURNING
    let lastID = null;
    if (res.rows && res.rows.length > 0 && res.rows[0].id) {
      lastID = res.rows[0].id;
    }
    return { lastID, changes: res.rowCount };
  }

  async exec(sql) {
    // In node-pg, multiple statements can be run as a single string
    return this.client.query(sql);
  }

  async prepare(sql) {
    const converted = _convertQuery(sql);
    const self = this;
    return {
      run: async (...args) => {
        // prepare.run in sqlite can take spread arguments
        return self.client.query(converted, args);
      },
      finalize: async () => {}
    };
  }
}

async function openDb() {
  // If we want transactional integrity across all() and run(), we should ideally checkout a client.
  // But for simple backward compatibility with sqlite openDb(), we can mostly just wrap the pool directly 
  // for queries unless inside an explicit transaction. 
  // Wait, many routes do `const db = await openDb(); ... db.all();`
  // We'll wrap the main pool for generic queries.
  return new DatabaseWrapper(pool);
}

// For transactions where a dedicated connection is needed
async function openTransactionDb() {
  const client = await pool.connect();
  const wrapper = new DatabaseWrapper(client);
  // Add release method
  wrapper.release = () => client.release();
  return wrapper;
}

async function initDb() {
  const db = await openDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP DEFAULT NULL,
      status TEXT DEFAULT 'approved',
      profile_image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      last_active_date TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      completion_percentage REAL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS labours (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_supervisors (
      id SERIAL PRIMARY KEY,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      supervisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_id, supervisor_id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      labour_id INTEGER NOT NULL REFERENCES labours(id),
      site_id INTEGER NOT NULL REFERENCES sites(id),
      supervisor_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      status TEXT CHECK(status IN ('full', 'half', 'absent')) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(labour_id, date)
    );

    CREATE TABLE IF NOT EXISTS daily_site_attendance_status (
      id SERIAL PRIMARY KEY,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      date TEXT NOT NULL,
      is_locked BOOLEAN DEFAULT false,
      food_provided BOOLEAN DEFAULT false,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      UNIQUE(site_id, date)
    );

    CREATE TABLE IF NOT EXISTS advances (
      id SERIAL PRIMARY KEY,
      labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revoked BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS overtime (
        id SERIAL PRIMARY KEY,
        labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        hours REAL NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS labour_refresh_tokens (
      id SERIAL PRIMARY KEY,
      labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revoked BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id SERIAL PRIMARY KEY,
      labour_id INTEGER REFERENCES labours(id) ON DELETE CASCADE,
      complaint TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salary_payments (
      id SERIAL PRIMARY KEY,
      labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      month_reference TEXT NOT NULL,
      payment_method TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bonus_payments (
      id SERIAL PRIMARY KEY,
      labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salary_history (
      id SERIAL PRIMARY KEY,
      labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
      previous_rate REAL,
      new_rate REAL NOT NULL,
      date TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS history_logs (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      reference_id INTEGER,
      name TEXT,
      metadata TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS labour_site_history (
      id SERIAL PRIMARY KEY,
      labour_id INTEGER NOT NULL REFERENCES labours(id) ON DELETE CASCADE,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      from_date TEXT NOT NULL,
      to_date TEXT
    );
  `);

  // Seed default food allowance rate if not set
  await db.run(
    `INSERT INTO app_settings (key, value) VALUES ('food_allowance_rate', '70')
     ON CONFLICT (key) DO NOTHING`
  );

  // Site status migration — safe for existing deployments
  const alterSafe = async (sql) => {
    try { await db.exec(sql); } catch (e) {
      if (!e.message?.includes('already exists') && e.code !== '42701') throw e;
    }
  };
  await alterSafe(`ALTER TABLE sites ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
  await alterSafe(`ALTER TABLE sites ADD COLUMN IF NOT EXISTS last_active_date TEXT DEFAULT NULL`);
  await alterSafe(`ALTER TABLE sites ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL`);
  await alterSafe(`ALTER TABLE sites ADD COLUMN IF NOT EXISTS completion_percentage REAL DEFAULT 0`);

  // Manual attendance migration — additive, does not affect existing auto-attendance
  await alterSafe(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS entry_mode TEXT DEFAULT 'auto'`);
  await alterSafe(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS allowance REAL DEFAULT 0`);
  await alterSafe(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_amount REAL DEFAULT 0`);
  await alterSafe(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS balance_adjustment REAL DEFAULT 0`);
  await alterSafe(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS balance_type TEXT DEFAULT 'none'`);
  await alterSafe(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS manual_note TEXT`);

  // Food allowance per-labour migration — additive
  await alterSafe(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS food_allowance BOOLEAN DEFAULT false`);

  // Search Indexes - PostgreSQL doesn't support IF NOT EXISTS for indexes directly in standard CREATE INDEX syntax 
  // without a slightly different query or just catching the error.
  const createIndexSafe = async (idxName, sql) => {
    try {
      await db.exec(sql);
    } catch (e) {
      if (e.code !== '42P07') { // 42P07 = duplicate_table (often thrown for existing indexes)
         // console.error(e);
      }
    }
  };

  await createIndexSafe('idx_labours_name', 'CREATE INDEX idx_labours_name ON labours(name);');
  await createIndexSafe('idx_labours_phone', 'CREATE INDEX idx_labours_phone ON labours(phone);');
  await createIndexSafe('idx_labours_trade', 'CREATE INDEX idx_labours_trade ON labours(trade);');
  await createIndexSafe('idx_users_name', 'CREATE INDEX idx_users_name ON users(name);');
  await createIndexSafe('idx_users_phone', 'CREATE INDEX idx_users_phone ON users(phone);');
  await createIndexSafe('idx_sites_name', 'CREATE INDEX idx_sites_name ON sites(name);');
  
  await createIndexSafe('idx_history_logs_type', 'CREATE INDEX idx_history_logs_type ON history_logs(type);');
  await createIndexSafe('idx_history_logs_action', 'CREATE INDEX idx_history_logs_action ON history_logs(action);');
  await createIndexSafe('idx_history_logs_created_at', 'CREATE INDEX idx_history_logs_created_at ON history_logs(created_at);');
  await createIndexSafe('idx_attendance_entry_mode', 'CREATE INDEX idx_attendance_entry_mode ON attendance(entry_mode);');
  await createIndexSafe('idx_attendance_date_labour_site', 'CREATE INDEX idx_attendance_date_labour_site ON attendance(date, labour_id, site_id);');

  await createIndexSafe('idx_labour_site_history_labour', 'CREATE INDEX idx_labour_site_history_labour ON labour_site_history(labour_id);');
  await createIndexSafe('idx_labour_site_history_site', 'CREATE INDEX idx_labour_site_history_site ON labour_site_history(site_id);');

  // Backfill script for existing active labour assignments
  const todayStr = new Date().toISOString().split('T')[0];
  try {
    await db.run(`
      INSERT INTO labour_site_history (labour_id, site_id, from_date)
      SELECT id, site_id, ?
      FROM labours
      WHERE site_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM labour_site_history h WHERE h.labour_id = labours.id AND h.to_date IS NULL
        )
    `, [todayStr]);
  } catch (e) {
    console.error('Error backfilling labour_site_history:', e);
  }

  console.log('Database initialized.');
  return db;
}

module.exports = { openDb, initDb, pool, openTransactionDb };
