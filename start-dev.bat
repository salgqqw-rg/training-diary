@echo off
REM Starts the local dev server at http://localhost:3000 (leave this window open)
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dev
pause
