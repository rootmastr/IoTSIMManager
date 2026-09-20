#!/bin/bash
# ============================================
# IoT SIM Manager - Deploy
# Server: 111.68.31.232:8282
# PostgreSQL: vigil-postgres (existing)
# ============================================

set -e

APP_DIR="/opt/IoTSIMManager"
REPO_URL="https://github.com/rootmastr/IoTSIMManager.git"
APP_PORT=8282

echo "========================================="
echo "  IoT SIM Manager - Docker Deploy"
echo "  Server: 111.68.31.232:$APP_PORT"
echo "  PostgreSQL: vigil-postgres"
echo "========================================="

# 1. Check Docker
echo "[1/6] Checking Docker..."
if ! command -v docker &> /dev/null; then
  echo "Docker not found!"
  exit 1
fi
if [ ! -f "docker-compose.app.yml" ]; then
  echo "docker-compose.app.yml not found!"
  exit 1
fi
echo "OK"

# 2. Setup database
echo "[2/6] Setting up database..."

# Generate password
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=')
JWT_SECRET=$(openssl rand -base64 32 | tr -d '/+=')

echo "  Creating database and user..."

# Create user and database in vigil-postgres
docker exec -i vigil-postgres psql -U vigil_admin -d vigil_prod <<SQL
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'iotsim') THEN
        CREATE ROLE iotsim WITH LOGIN PASSWORD '$DB_PASS';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE iotsimdb OWNER iotsim'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'iotsimdb')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE iotsimdb TO iotsim;
ALTER USER iotsim CREATEDB;
SQL

echo "  Database created"

# 3. Clone or pull repo
echo "[3/6] Getting source code..."
if [ -d "$APP_DIR" ]; then
  cd $APP_DIR
  sudo git pull origin main
else
  sudo git clone $REPO_URL $APP_DIR
  cd $APP_DIR
fi

# 4. Build frontend
echo "[4/6] Building frontend..."
sudo npm install
sudo npm run build

# 5. Create .env and start
echo "[5/6] Starting services..."
sudo tee $APP_DIR/.env > /dev/null <<EOF
DB_PASS=$DB_PASS
JWT_SECRET=$JWT_SECRET
EOF

# Stop old containers if any
docker compose -f docker-compose.app.yml down 2>/dev/null || true

# Start new containers
docker compose -f docker-compose.app.yml up -d --build

# Wait for backend
echo "Waiting for backend to start..."
sleep 8

# 6. Init schema
echo "[6/6] Initializing database schema..."
docker exec -i vigil-postgres psql -U vigil_admin -d iotsimdb <<'SQL'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_phone ON devices(phone);
CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);
CREATE INDEX IF NOT EXISTS idx_history_device_id ON device_history(device_id);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON device_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON device_history(user_id);

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
SQL

echo ""
echo "========================================="
echo "  Deploy Berhasil!"
echo "========================================="
echo ""
echo "  URL:         http://111.68.31.232:$APP_PORT"
echo "  Database:    iotsimdb @ vigil-postgres:5432"
echo "  DB User:     iotsim"
echo "  DB Password: $DB_PASS"
echo "  App Dir:     $APP_DIR"
echo ""
echo "  Login:       http://111.68.31.232:$APP_PORT/login"
echo ""
echo "  Buat admin pertama:"
echo "  curl -X POST http://111.68.31.232:$APP_PORT/api/auth/register \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"admin\",\"password\":\"admin123\",\"full_name\":\"Administrator\",\"role\":\"admin\"}'"
echo ""
echo "  Status:      docker compose -f docker-compose.app.yml ps"
echo "  Logs:        docker compose -f docker-compose.app.yml logs -f"
echo "  Redeploy:    cd $APP_DIR && bash deploy-existing-pg.sh"
echo ""
echo "  *** SIMPAN PASSWORD INI: $DB_PASS ***"
echo ""
