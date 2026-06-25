# Start Next.js dari paket standalone — TIDAK perlu npm install di server
param(
    [string]$ProjectRoot = 'C:\xampp\htdocs\work-orders',
    [int]$Port = 3002
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'deploy.config.ps1')
if ($Port -eq 3002) { $Port = $script:WO_APS_FRONTEND_PORT }

$deploy = Join-Path $ProjectRoot 'deploy\wo-aps-frontend'
$serverJs = Join-Path $deploy 'server.js'

if (-not (Test-Path $serverJs)) {
    Write-Host 'Paket standalone tidak ada.' -ForegroundColor Red
    Write-Host "Path: $deploy" -ForegroundColor Red
    Write-Host ''
    Write-Host 'Di PC development:' -ForegroundColor Yellow
    Write-Host '  cd frontend && npm run build'
    Write-Host '  powershell -File scripts\package-frontend-for-server.ps1'
    Write-Host 'Lalu copy folder deploy\wo-aps-frontend ke server.'
    exit 1
}

$env:PORT = $Port
$env:HOSTNAME = '0.0.0.0'
$env:API_BACKEND_URL = 'http://127.0.0.1:8000'

Write-Host "Starting standalone Next.js on http://0.0.0.0:$Port" -ForegroundColor Cyan
Write-Host "API proxy: $env:API_BACKEND_URL/api -> browser /api" -ForegroundColor Gray
Set-Location $deploy
node server.js
