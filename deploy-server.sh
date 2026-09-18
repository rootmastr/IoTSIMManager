#!/bin/bash
# ============================================
# IoT SIM Manager - Server Deployment via Git
# IP: 111.68.31.232 Port: 8282
# ============================================

set -e

REPO_URL="https://github.com/rootmastr/IoTSIMManager.git"
APP_NAME="iotsimmanager"
APP_DIR="/opt/IoTSIMManager"
DB_NAME="iotsimdb"
DB_USER="iotsim"
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=')
JWT_SECRET=$(openssl rand -base64 32 | tr -d '/+=')
NODE_VERSION="22"
APP_PORT=8282
SERVER_IP="111.68.31.232"

echo "========================================="
echo "  IoT SIM Manager - Deploy Script"
echo "  Server: $SERVER_IP:$APP_PORT"
echo "========================================="

# 1. System update
echo "[1/11] Updating system..."
sudo apt update && sudo apt upgrade -y

# 2. Install dependencies
echo "[2/11] Installing base packages..."
sudo apt install -y curl git build-essential nginx

# 3. Install Node.js
echo "[3/11] Installing Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt install -y nodejs
fi
echo "Node: $(node -v), NPM: $(npm -v)"

# 4. Install PostgreSQL
echo "[4/11] Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
  sudo apt install -y postgresql postgresql-contrib
fi
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 5. Setup database
echo "[5/11] Setting up database..."
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"

# Fix pg_hba.conf - allow password auth for local connections
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" | tr -d ' ')
echo "[5b/11] Configuring PostgreSQL auth..."
sudo sed -i 's/local\s\+all\s\+all\s\+peer/local   all             all                                     md5/' "$PG_HBA" 2>/dev/null || true
sudo sed -i 's/host\s\+all\s\+all\s\+127.0.0.1\/32\s\+scram-sha-256/host    all             all             127.0.0.1\/32            md5/' "$PG_HBA" 2>/dev/null || true
sudo sed -i 's/host\s\+all\s\+all\s\+::1\/128\s\+scram-sha-256/host    all             all             ::1\/128                 md5/' "$PG_HBA" 2>/dev/null || true
sudo systemctl restart postgresql

# Init schema via psql (bypass Node.js pg driver)
echo "[5c/11] Initializing database schema..."
sudo -u postgres psql -d $DB_NAME <<'SQL'
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
echo "Schema initialized."

# 6. Clone repo
echo "[6/11] Cloning repository..."
if [ -d "$APP_DIR" ]; then
  cd $APP_DIR
  sudo git pull origin main
else
  sudo git clone $REPO_URL $APP_DIR
  cd $APP_DIR
fi

# 7. Create .env
echo "[7/11] Creating .env file..."
sudo tee $APP_DIR/backend/.env > /dev/null <<EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
PORT=3232
NODE_ENV=production
FRONTEND_URL=http://$SERVER_IP:$APP_PORT
EOF

# 8. Install backend dependencies
echo "[8/11] Installing backend dependencies..."
cd $APP_DIR/backend
sudo npm install --production

# 9. Build frontend
echo "[9/11] Building frontend..."
cd $APP_DIR
sudo npm install
sudo npm run build

# 10. Skip - schema already initialized via psql
echo "[10/11] Schema already initialized via psql."

# 11. Setup systemd & nginx
echo "[11/11] Configuring services..."

# Systemd service
sudo tee /etc/systemd/system/$APP_NAME.service > /dev/null <<EOF
[Unit]
Description=IoT SIM Manager Backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME
sudo systemctl restart $APP_NAME

# Nginx config - port 8282
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<NGINX
server {
    listen $APP_PORT;
    server_name $SERVER_IP _;

    client_max_body_size 10M;

    location / {
        root /opt/IoTSIMManager/dist;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3232;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "========================================="
echo "  Deploy Berhasil!"
echo "========================================="
echo ""
echo "  URL:         http://$SERVER_IP:$APP_PORT"
echo "  Database:    $DB_NAME"
echo "  DB User:     $DB_USER"
echo "  DB Password: $DB_PASS"
echo "  App Dir:     $APP_DIR"
echo ""
echo "  Login:       http://$SERVER_IP:$APP_PORT/login"
echo ""
echo "  Buat admin pertama:"
echo "  curl -X POST http://$SERVER_IP:$APP_PORT/api/auth/register \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"admin\",\"password\":\"admin123\",\"full_name\":\"Administrator\",\"role\":\"admin\"}'"
echo ""
echo "  Service:     sudo systemctl status $APP_NAME"
echo "  Logs:        sudo journalctl -u $APP_NAME -f"
echo "  Redeploy:    cd $APP_DIR && sudo bash redeploy.sh"
echo ""
echo "  *** SIMPAN PASSWORD INI: $DB_PASS ***"
echo ""
