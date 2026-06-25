@echo off
REM Start Next.js production - jalankan dari folder project atau double-click
cd /d C:\xampp\htdocs\work-orders\frontend

if not exist "node_modules\next\package.json" (
    echo node_modules belum ada. Jalankan dulu:
    echo   npm install --os=win32 --cpu=x64
    pause
    exit /b 1
)

if not exist ".next" (
    echo Belum ada build. Jalankan dulu: npm run build
    pause
    exit /b 1
)

set API_BACKEND_URL=http://127.0.0.1:8000
set PORT=3002
set HOSTNAME=0.0.0.0
echo Starting Next.js on http://0.0.0.0:3002 ...
call npx next start -p 3002 -H 0.0.0.0
pause
