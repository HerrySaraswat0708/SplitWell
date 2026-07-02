const { Pool, types } = require('pg');

// Return TIMESTAMP columns as plain strings instead of auto-converted JS Date
// objects — the rest of the app (and the frontend's date parsing) was built
// around plain date/time strings, same as what the old SQLite driver returned.
types.setTypeParser(1114, v => v); // timestamp without time zone

// Neon/Supabase connection strings include `sslmode=require`; local/self-hosted
// Postgres usually doesn't need TLS at all.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

// SQLite-style `?` placeholders → Postgres `$1, $2, ...`
function toPgParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function run(sql, params = []) {
  return pool.query(toPgParams(sql), params);
}

async function get(sql, params = []) {
  const { rows } = await pool.query(toPgParams(sql), params);
  return rows[0] || null;
}

async function all(sql, params = []) {
  const { rows } = await pool.query(toPgParams(sql), params);
  return rows;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#6366f1',
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'other',
    cover_color TEXT DEFAULT '#10b981',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    paid_by INTEGER NOT NULL REFERENCES users(id),
    category TEXT DEFAULT 'other',
    split_type TEXT DEFAULT 'equal',
    date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expense_splits (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settlements (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id),
    paid_by INTEGER NOT NULL REFERENCES users(id),
    paid_to INTEGER NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

async function init() {
  await pool.query(SCHEMA);
}

module.exports = { pool, run, get, all, init };
