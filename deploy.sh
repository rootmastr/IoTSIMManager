#!/bin/bash
# IoT SIM Manager - Ubuntu Server Deployment Script
# Tested on Ubuntu 22.04/24.04 LTS

set -e

APP_NAME="iotsimmanager"
APP_DIR="/var/www/$APP_NAME"
DB_NAME="iotsimdb"
DB_USER="iotsim"
DB_PASS=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 32)
NODE_VERSION="22"

echo "========================================="
echo "  IoT SIM Manager - Deployment Script"
echo "========================================="

# 1. System update
echo "[1/10] Updating system..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
echo "[2/10] Installing Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt install -y nodejs
fi
echo "Node: $(node -v), NPM: $(npm -v)"

# 3. Install PostgreSQL
echo "[3/10] Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
  sudo apt install -y postgresql postgresql-contrib
fi
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 4. Setup database
echo "[4/10] Setting up database..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" 2>/dev/null || true

# 5. Install Nginx
echo "[5/10] Installing Nginx..."
sudo apt install -y nginx
sudo systemctl enable nginx

# 6. Deploy app
echo "[6/10] Deploying application..."
sudo mkdir -p $APP_DIR
sudo cp -r ../backend/* $APP_DIR/
sudo cp -r ../dist $APP_DIR/frontend

# 7. Create .env
echo "[7/10] Creating environment config..."
sudo tee $APP_DIR/.env > /dev/null <<EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://localhost
EOF

# 8. Install dependencies & init DB
echo "[8/10] Installing dependencies & initializing database..."
cd $APP_DIR
sudo npm install --production
sudo node src/config/init.js

# 9. Setup systemd service
echo "[9/10] Setting up systemd service..."
sudo tee /etc/systemd/system/$APP_NAME.service > /dev/null <<EOF
[Unit]
Description=IoT SIM Manager Backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR
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

# 10. Configure Nginx
echo "[10/10] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        root /var/www/iotsimmanager/frontend;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "  App URL:    http://$(hostname -I | awk '{print $1}')"
echo "  DB Name:    $DB_NAME"
echo "  DB User:    $DB_USER"
echo "  DB Pass:    $DB_PASS"
echo "  App Dir:    $APP_DIR"
echo ""
echo "  Create admin account:"
echo "  curl -X POST http://localhost/api/auth/register \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"admin\",\"password\":\"your_password\",\"full_name\":\"Administrator\",\"role\":\"admin\"}'"
echo ""
echo "  Service:    sudo systemctl status $APP_NAME"
echo "  Logs:       sudo journalctl -u $APP_NAME -f"
echo "  Backup DB:  pg_dump -U $DB_USER $DB_NAME > backup.sql"
echo ""
