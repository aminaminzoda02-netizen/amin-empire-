#!/usr/bin/env bash
set -e
command -v node >/dev/null || { echo 'Node.js 18+ лозим аст.'; exit 1; }
npm install
[ -f .env ] || cp .env.example .env
node -e "console.log('AMIN EMPIRE dependencies ready')"
echo 'Start: npm start'
