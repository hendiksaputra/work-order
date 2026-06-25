# Bersihkan & install ulang frontend di Windows (fix error oxide-wasm32-wasi)
param(
    [string]$ProjectRoot = 'C:\xampp\htdocs\work-orders'
)

$ErrorActionPreference = 'Stop'
$frontend = Join-Path $ProjectRoot 'frontend'

if (-not (Test-Path $frontend)) { throw "Folder tidak ada: $frontend" }

Write-Host "==> Clean install frontend (Windows x64)" -ForegroundColor Cyan
Write-Host "    Gunakan PowerShell/CMD — JANGAN Git Bash MINGW64 untuk npm" -ForegroundColor Yellow

Push-Location $frontend

if (Test-Path 'node_modules') {
    Write-Host "    Menghapus node_modules..."
    Remove-Item -Recurse -Force 'node_modules'
}

npm cache clean --force
npm install --os=win32 --cpu=x64

Write-Host "==> Build production..." -ForegroundColor Cyan
npm run build

Pop-Location
Write-Host "Selesai." -ForegroundColor Green
