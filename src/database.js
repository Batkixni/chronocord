const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('[DB WARNING] DATABASE_URL is not set. Database operations will fail until configured.');
  }

  const useSsl =
    process.env.DATABASE_SSL === 'true' ||
    (connectionString && connectionString.includes('sslmode=require'));

  const poolConfig = {
    connectionString,
    max: Number(process.env.DB_POOL_MAX) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  if (useSsl) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('[DB ERROR] Unexpected error on idle client:', err.message);
  });

  return pool;
}

const pool = createPool();

const CAMEL_CASE_KEYS = {
  guildid: 'guildId',
  channelid: 'channelId',
  creatorid: 'creatorId',
  scheduledat: 'scheduledAt',
  targetroleids: 'targetRoleIds',
  targetuserids: 'targetUserIds',
  remindersent: 'reminderSent',
  messageid: 'messageId',
  meetingid: 'meetingId',
  userid: 'userId',
  timevoteid: 'timevoteId',
  optionindex: 'optionIndex',
  createdat: 'createdAt',
};

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  for (const [lowerKey, camelKey] of Object.entries(CAMEL_CASE_KEYS)) {
    if (lowerKey in row && !(camelKey in row)) {
      row[camelKey] = row[lowerKey];
    }
  }
  return row;
}

function formatSql(sql) {
  let paramIndex = 1;
  // Convert ? to $1, $2, ...
  let formatted = sql.replace(/\?/g, () => `$${paramIndex++}`);
  // Safety fallback for SQLite datetime('now')
  formatted = formatted.replace(/datetime\(\s*'now'\s*\)/gi, 'CURRENT_TIMESTAMP');
  return formatted;
}

const db = {
  pool,

  async execute(queryParam, argsParam = []) {
    let sql;
    let args;

    if (typeof queryParam === 'string') {
      sql = queryParam;
      args = argsParam;
    } else if (queryParam && typeof queryParam === 'object') {
      sql = queryParam.sql;
      args = queryParam.args || [];
    } else {
      throw new Error('Invalid query parameter passed to db.execute');
    }

    const formattedSql = formatSql(sql);
    const result = await pool.query(formattedSql, args);

    if (Array.isArray(result.rows)) {
      result.rows = result.rows.map(normalizeRow);
      if (result.rows.length > 0 && result.rows[0].id !== undefined) {
        result.lastInsertRowid = Number(result.rows[0].id);
      }
    }

    return result;
  },

  async query(sql, args = []) {
    return this.execute(sql, args);
  },
};

async function initSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      guildId TEXT NOT NULL,
      channelId TEXT NOT NULL,
      creatorId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      scheduledAt TEXT NOT NULL,
      targetRoleIds TEXT,
      targetUserIds TEXT,
      reminderSent INTEGER DEFAULT 0,
      messageId TEXT,
      recurrence TEXT DEFAULT 'none'
    )
  `);

  await db.execute(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS messageId TEXT`);
  await db.execute(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'none'`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS rsvps (
      id SERIAL PRIMARY KEY,
      meetingId INTEGER NOT NULL,
      userId TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(meetingId, userId)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      discord_name TEXT,
      discord_avatar TEXT,
      access_token TEXT,
      refresh_token TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS availabilities (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_minute INTEGER NOT NULL,
      end_minute INTEGER NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      labels TEXT,
      UNIQUE(user_id, day_of_week, start_minute)
    )
  `);

  await db.execute(`ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS labels TEXT`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      public_view INTEGER DEFAULT 1,
      updated_by TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS timevotes (
      id SERIAL PRIMARY KEY,
      guildId TEXT NOT NULL,
      channelId TEXT NOT NULL,
      creatorId TEXT NOT NULL,
      title TEXT NOT NULL,
      options TEXT NOT NULL,
      messageId TEXT,
      createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS timevote_votes (
      timevoteId INTEGER NOT NULL,
      userId TEXT NOT NULL,
      optionIndex INTEGER NOT NULL,
      PRIMARY KEY (timevoteId, userId)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_guild_privacy (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      show_schedule INTEGER DEFAULT 1,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS guild_events (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      event_date TEXT NOT NULL,
      end_date TEXT,
      start_time TEXT,
      end_time TEXT,
      priority TEXT DEFAULT 'medium',
      tag TEXT,
      repeat_type TEXT DEFAULT 'none',
      repeat_until TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS end_date TEXT`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS event_rsvps (
      event_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_id, user_id)
    )
  `);
}

module.exports = { db, pool, initSchema };
