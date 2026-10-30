@echo off
REM Imports Open Food Facts products (Russia, Belarus, Kazakhstan) into Supabase table food_catalog.
REM Run migration_15_food_catalog.sql in Supabase SQL Editor FIRST.
cd /d "%~dp0"
if not exist node_modules call npm install

echo.
echo === Step 1: dry run (nothing is written, shows how many products match) ===
node scripts\import-openfoodfacts.mjs --dry-run
echo.
set /p GO="Dry run finished. Press Y and Enter to load into Supabase, anything else to stop: "
if /i not "%GO%"=="Y" goto :end

echo.
echo === Step 2: real import (can take tens of minutes, keep this window open) ===
node scripts\import-openfoodfacts.mjs

:end
echo.
pause
