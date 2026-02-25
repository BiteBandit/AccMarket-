#!/bin/bash
cd ~/storage/shared/Download/AccMarket
git status
git add .
git commit -m "Update AccMarket: $(date '+%Y-%m-%d %H:%M:%S')"
git pull origin main --no-rebase
git push origin main
echo "✅ AccMarket deployed!"
