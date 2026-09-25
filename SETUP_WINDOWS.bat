@echo off
where node >nul 2>nul || (echo Node.js 18+ лозим аст. & pause & exit /b 1)
npm install
if not exist .env copy .env.example .env
node -e "console.log('AMIN EMPIRE dependencies ready')"
echo Start: npm start
pause
