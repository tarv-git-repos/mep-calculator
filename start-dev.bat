@echo off
cd /d "%~dp0\frontend"
set "NODE_OPTIONS=--experimental-require-module"
npm run dev
pause
