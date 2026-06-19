#!/bin/bash
GIT_CMD="git --git-dir=/storage/emulated/0/Download/Accmarket/.git --work-tree=/storage/emulated/0/Download/Accmarket"

$GIT_CMD status
$GIT_CMD add .
$GIT_CMD commit -m "Update AccMarket: $(date '+%Y-%m-%d %H:%M:%S')"
$GIT_CMD pull origin main --no-rebase
$GIT_CMD push origin main
echo "✅ AccMarket deployed!"
