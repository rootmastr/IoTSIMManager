#!/bin/bash
# ============================================
# IoT SIM Manager - Docker Deploy Script
# Server: 111.68.31.232:8282
# ============================================

set -e

APP_DIR="/opt/IoTSIMManager"
REPO_URL="https://github.com/rootmastr/IoTSIMManager.git"
APP_PORT=8282

echo "========================================="
echo "  IoT SIM Manager - Docker Deploy"
echo "  Server: 111.68.31.232:$APP_PORT"
echo "========================================="

# 1. Check Docker
echo "[1/5] Checking Docker..."
if ! command -v docker &> /dev/null; then
  echo "Docker not found! Install via aaPanel or run:"
  echo "  curl -fsSL https://get.docker.com | sh"
  exit 1
fi
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "Docker Compose not found!"
  echo "  sudo apt install docker-compose-plugin"
  exit 1
fi
echo "Docker: $(docker -v)"
echo "Compose: $(docker compose version 2>/dev/null || docker-compose -v)"

# 2. Clone or pull repo
echo "[2/5] Getting source code..."
if [ -d "$APP_DIR" ]; then
  cd $APP_DIR
  sudo git pull origin main
else
  sudo git clone $REPO_URL $APP_DIR
  cd $APP_DIR
fi

# 3. Build frontend
echo "[3/5] Building frontend..."
sudo npm install
sudo npm run build

# 4. Generate secrets
echo "[4/5] Generating secrets..."
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=')
JWT_SECRET=$(openssl rand -base64 32 | tr -d '/+=')

# Create .env for docker-compose
sudo tee $APP_DIR/.env > /dev/null <<EOF
DB_PASS=$DB_PASS
JWT_SECRET=$JWT_SECRET
EOF

echo "  DB Password: $DB_PASS"
echo "  JWT Secret:  $JWT_SECRET"

# 5. Start containers
echo "[5/5] Starting containers..."
if docker compose version &> /dev/null; then
  sudo docker compose up -d --build
else
  sudo docker-compose up -d --build
fi

# Wait for backend
echo "Waiting for backend to start..."
sleep 5

# Init database schema
echo "Initializing database schema..."
sudo docker exec -i iotsimmanager-db-1 psql -U iotsim -d iotsimdb <<'SQL'
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
echo "  Database:    iotsimdb"
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
echo "  Status:      docker compose ps"
echo "  Logs:        docker compose logs -f"
echo "  Redeploy:    cd $APP_DIR && bash deploy-docker.sh"
echo ""
echo "  *** SIMPAN PASSWORD INI: $DB_PASS ***"
echo ""
