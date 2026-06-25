# Jalankan API + Frontend di background (tanpa Windows Service)
# Proses tetap jalan walau terminal pemanggil ditutup, TAPI hilang saat server restart.
# Untuk production permanen, pakai install-wo-aps-services.ps1

param(
    [string]$ProjectRoot,
    [int]$FrontendPort,
    [int]$ApiPort
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'deploy.config.ps1')

if (-not $ProjectRoot) { $ProjectRoot = $script:WO_APS_PROJECT_ROOT }
if (-not $FrontendPort) { $FrontendPort = $script:WO_APS_FRONTEND_PORT }
if (-not $ApiPort) { $ApiPort = $script:WO_APS_API_PORT }

$backend = Join-Path $ProjectRoot 'backend'
$frontendDeploy = Join-Path $ProjectRoot 'deploy\wo-aps-frontend'
$serverJs = Join-Path $frontendDeploy 'server.js'
$logs = Join-Path $ProjectRoot 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$php = (Get-Command php -ErrorAction Stop).Source
$node = (Get-Command node -ErrorAction Stop).Source

if (-not (Test-Path $serverJs)) {
    throw "Paket standalone tidak ada: $serverJs"
}

# Hentikan instance lama di port yang sama (opsional)
foreach ($p in @($ApiPort, $FrontendPort)) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Write-Host "Port $p sudah dipakai PID $($conn.OwningProcess) — dilewati" -ForegroundColor Yellow
    }
}

Write-Host 'Starting WO APS di background ...' -ForegroundColor Cyan

Start-Process -FilePath $php `
    -ArgumentList "artisan serve --host=0.0.0.0 --port=$ApiPort" `
    -WorkingDirectory $backend `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'api-out.log') `
    -RedirectStandardError (Join-Path $logs 'api-err.log')

Start-Sleep -Seconds 2

$env:PORT = $FrontendPort
$env:HOSTNAME = '0.0.0.0'
$env:API_BACKEND_URL = "http://127.0.0.1:$ApiPort"

Start-Process -FilePath $node `
    -ArgumentList 'server.js' `
    -WorkingDirectory $frontendDeploy `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'frontend-out.log') `
    -RedirectStandardError (Join-Path $logs 'frontend-err.log')

Write-Host "API      : http://127.0.0.1:$ApiPort" -ForegroundColor Green
Write-Host "Frontend : http://0.0.0.0:$FrontendPort" -ForegroundColor Green
Write-Host 'Proses berjalan terpisah — terminal ini boleh ditutup.' -ForegroundColor Gray
Write-Host "Log: $logs" -ForegroundColor Gray
Write-Host ''
Write-Host 'Untuk auto-start saat boot, jalankan (Admin): install-wo-aps-services.ps1' -ForegroundColor Yellow
