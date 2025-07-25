@echo off
echo.
echo ===============================================
echo   Starting AI Property Research Admin Server
echo ===============================================
echo.
echo 🔐 Admin server will run on http://localhost:3001
echo 👤 This is COMPLETELY SEPARATE from main app
echo 🔒 Regular users cannot discover this exists
echo.

cd /d "%~dp0"

echo Starting admin server...
node server/admin-server.js

echo.
echo Admin server stopped.
pause 