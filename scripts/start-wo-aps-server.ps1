# Jalankan di server Windows — buka 2 jendela PowerShell (API + Frontend)

param(
    [string]$ServerIp,
    [int]$FrontendPort,
    [int]$ApiPort,
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'deploy.config.ps1')

if (-not $ServerIp) { $ServerIp = $script:WO_APS_SERVER_IP }
if (-not $FrontendPort) { $FrontendPort = $script:WO_APS_FRONTEND_PORT }
if (-not $ApiPort) { $ApiPort = $script:WO_APS_API_PORT }
if (-not $ProjectRoot) { $ProjectRoot = $script:WO_APS_PROJECT_ROOT }

$backend = Join-Path $ProjectRoot 'backend'
$frontend = Join-Path $ProjectRoot 'frontend'

if (-not (Test-Path $backend)) { throw "Folder backend tidak ada: $backend" }
if (-not (Test-Path $frontend)) { throw "Folder frontend tidak ada: $frontend" }
$standaloneDeploy = Join-Path $ProjectRoot 'deploy\wo-aps-frontend\server.js'
$hasStandalone = Test-Path $standaloneDeploy
$hasNextBuild = Test-Path (Join-Path $frontend '.next')
if (-not $hasStandalone -and -not $hasNextBuild) {
    throw "Belum ada build frontend. Paket standalone atau npm run build diperlukan."
}

Write-Host "Work Order APS — start services" -ForegroundColor Cyan
Write-Host "  Frontend : http://${ServerIp}:${FrontendPort}" -ForegroundColor Green
Write-Host "  API      : http://${ServerIp}:${ApiPort}/api" -ForegroundColor Green
Write-Host ""
Write-Host "Port bentrok? Edit scripts\deploy.config.ps1 atau jalankan find-free-port.ps1" -ForegroundColor Yellow
Write-Host "Firewall: izinkan inbound TCP $FrontendPort dan $ApiPort" -ForegroundColor Yellow
Write-Host ""

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$backend'; Write-Host 'Laravel API port $ApiPort' -ForegroundColor Cyan; php artisan serve --host=0.0.0.0 --port=$ApiPort"
)

Start-Sleep -Seconds 2

if ($hasStandalone) {
    $frontendCmd = "powershell -ExecutionPolicy Bypass -File '$ProjectRoot\scripts\start-frontend-standalone.ps1' -Port $FrontendPort"
} else {
    $frontendCmd = "cd '$frontend'; `$env:PORT=$FrontendPort; `$env:HOSTNAME='0.0.0.0'; Write-Host 'Next.js port $FrontendPort' -ForegroundColor Cyan; npx next start -p $FrontendPort -H 0.0.0.0"
}
Start-Process powershell -ArgumentList @('-NoExit', '-Command', $frontendCmd)

Write-Host "Dua jendela PowerShell dibuka. Tutup jendela = service berhenti." -ForegroundColor Gray
