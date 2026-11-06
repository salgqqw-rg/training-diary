@echo off
chcp 65001 >nul
REM One-click deploy to Vercel: check -> login -> keys from .env.local -> production deploy.
REM Everything is also written to deploy-log.txt (Claude reads it, no need to copy text).
cd /d "%~dp0"
echo Deploy log %date% %time% > deploy-log.txt

if not exist node_modules (
  echo === npm install ===
  call npm install >> deploy-log.txt 2>&1
  if errorlevel 1 goto :fail
)

echo === Step 1/4: check (types and tests) ===
echo === Step 1/4: check === >> deploy-log.txt
call npm run check >> deploy-log.txt 2>&1
if errorlevel 1 goto :fail
echo ok

echo === Step 2/4: Vercel login ===
call npx --yes vercel whoami >nul 2>&1 || call npx --yes vercel login
echo === Step 2/4: whoami === >> deploy-log.txt
call npx --yes vercel whoami >> deploy-log.txt 2>&1
if errorlevel 1 goto :fail
echo ok

echo === Step 3/4: keys from .env.local to Vercel (Production) ===
echo === Step 3/4: keys === >> deploy-log.txt
node scripts\vercel-env.mjs >> deploy-log.txt 2>&1
if errorlevel 1 goto :fail
echo ok

echo === Step 4/4: deploy (takes a few minutes, please wait) ===
echo === Step 4/4: deploy === >> deploy-log.txt
call npx --yes vercel --prod --yes >> deploy-log.txt 2>&1
if errorlevel 1 goto :fail

echo.
type deploy-log.txt
echo.
echo DONE. Production URL is in the text above. Tell Claude "done".
goto :end

:fail
echo.
type deploy-log.txt
echo.
echo FAILED. The full text is saved in deploy-log.txt. Tell Claude "failed" - no need to copy anything.

:end
echo.
pause
