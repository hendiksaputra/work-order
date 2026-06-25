# Setup sekali di server setelah copy folder ke C:\xampp\htdocs\work-orders

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
$apiUrl = "http://${ServerIp}:${ApiPort}/api"
$frontendOrigin = "http://${ServerIp}:${FrontendPort}"

Write-Host "==> Setup Work Order APS di $ProjectRoot" -ForegroundColor Cyan
Write-Host "    Frontend port: $FrontendPort | API port: $ApiPort" -ForegroundColor Gray

# Backend .env
Push-Location $backend
if (-not (Test-Path '.env')) {
    if (Test-Path '.env.server.example') { Copy-Item '.env.server.example' '.env' }
    elseif (Test-Path '.env.example') { Copy-Item '.env.example' '.env' }
}
if (-not (Select-String -Path '.env' -Pattern '^APP_KEY=' -Quiet) -or (Select-String -Path '.env' -Pattern '^APP_KEY=\s*$')) {
    php artisan key:generate --force
}
php artisan migrate --force
php artisan config:clear
php artisan cache:clear
Pop-Location

# Frontend env production
$prodEnv = Join-Path $frontend '.env.production'
@"
NEXT_PUBLIC_API_URL=$apiUrl
PORT=$FrontendPort
HOSTNAME=0.0.0.0
"@ | Set-Content -Path $prodEnv -Encoding UTF8
Write-Host "    frontend/.env.production -> $apiUrl (port $FrontendPort)" -ForegroundColor Green

# Build frontend (PowerShell only — jangan Git Bash)
Push-Location $frontend
npm install --os=win32 --cpu=x64
npm run build
Pop-Location

Write-Host ""
Write-Host "Setup selesai. Langkah berikut:" -ForegroundColor Green
Write-Host "  1. Edit backend\.env — DB_PASSWORD, APP_DEBUG=false"
Write-Host "  2. Set di backend\.env:"
Write-Host "     CORS_ALLOWED_ORIGINS=$frontendOrigin,http://localhost:${FrontendPort}"
Write-Host "     SANCTUM_STATEFUL_DOMAINS=${ServerIp}:${FrontendPort},localhost:${FrontendPort}"
Write-Host "  3. php artisan config:clear  (di folder backend)"
Write-Host "  4. Firewall TCP $FrontendPort dan $ApiPort"
Write-Host "  5. powershell -File scripts\start-wo-aps-server.ps1"
Write-Host "  6. Client: $frontendOrigin"
