import pool from './database.js';

const SCHEMA = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) DEFAULT '',
    role VARCHAR(20) NOT NULL DEFAULT 'operator'
        CHECK (role IN ('admin', 'operator', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    location VARCHAR(200) NOT NULL,
    card_type VARCHAR(20) DEFAULT ''
        CHECK (card_type IN ('', 'Prabayar', 'Pascabayar', 'IoT')),
    operator VARCHAR(20) DEFAULT ''
        CHECK (operator IN ('', 'Telkomsel', 'Byu', 'Indosat', 'Tri', 'XL', 'Axis')),
    package_amount_mb INTEGER DEFAULT 0,
    package_start_date DATE,
    package_duration_days INTEGER DEFAULT 0,
    package_cost NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Device history table
CREATE TABLE IF NOT EXISTS device_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL
        CHECK (action IN ('add', 'update', 'package_update', 'delete')),
    device_name VARCHAR(100),
    phone VARCHAR(20),
    location VARCHAR(200),
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_phone ON devices(phone);
CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);
CREATE INDEX IF NOT EXISTS idx_history_device_id ON device_history(device_id);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON device_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON device_history(user_id);

-- 5. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_devices_updated_at') THEN
        CREATE TRIGGER trg_devices_updated_at
            BEFORE UPDATE ON devices
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END;
$$;
`;

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing database schema...');
    await client.query(SCHEMA);
    console.log('Database schema initialized successfully.');

    // Check if admin user exists
    const res = await client.query("SELECT id FROM users WHERE username = 'admin'");
    if (res.rows.length === 0) {
      console.log('No admin user found. Create one via POST /api/auth/register');
    }
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
