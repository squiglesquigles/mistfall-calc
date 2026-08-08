@echo off
cd /d "%~dp0"
echo Starting Mistfall Hunter Build Calculator...
echo.
echo Server: http://localhost:3001
echo.
start "" http://localhost:3001
node backend/server.js
pause