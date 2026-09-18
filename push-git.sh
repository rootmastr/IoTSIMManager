#!/bin/bash
# ============================================
# IoT SIM Manager - Push to GitHub
# Jalankan dari lokal untuk push ke GitHub
# ============================================

set -e

REPO="https://github.com/rootmastr/IoTSIMManager.git"

echo "========================================="
echo "  IoT SIM Manager - Push to GitHub"
echo "========================================="

# Get commit message from argument or prompt
if [ -n "$1" ]; then
  MSG="$1"
else
  read -p "Commit message: " MSG
  if [ -z "$MSG" ]; then
    MSG="update $(date '+%Y-%m-%d %H:%M:%S')"
  fi
fi

echo "[1/3] Adding files..."
git add -A

echo "[2/3] Committing: $MSG"
git commit -m "$MSG"

echo "[3/3] Pushing to GitHub..."
git push origin main

echo ""
echo "Push berhasil!"
echo "Repo: $REPO"
echo ""
