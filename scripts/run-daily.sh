#!/bin/zsh
set -euo pipefail
cd /Users/isabel_martins/Downloads/copper-earnings-calendar
python3 scripts/update_feed.py

if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A -- ':!netlify_deploy' ':!*.zip'
  git commit -m "Daily feed update $(date +%Y-%m-%d)"
  git push origin main
fi
