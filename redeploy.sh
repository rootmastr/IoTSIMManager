#!/bin/bash
# ============================================
# IoT SIM Manager - Redeploy Script
# Jalankan di server untuk update dari Git
# ============================================

set -e

APP_DIR="/var/www/iotsimmanager"

echo "[1/4] Pulling latest code..."
cd $APP_DIR
sudo git pull origin main

echo "[2/4] Installing backend dependencies..."
cd $APP_DIR/backend
sudo npm install --production

echo "[3/4] Building frontend..."
cd $APP_DIR
sudo npm install
sudo npm run build

echo "[4/4] Restarting service..."
sudo systemctl restart iotsimmanager

echo ""
echo "Redeploy selesai!"
echo "URL: http://111.68.31.232:8282"
