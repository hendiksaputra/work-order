# Diagnosa: client tidak bisa akses http://IP:PORT
# Jalankan di SERVER (PowerShell as Admin untuk cek firewall)

param(
    [string]$ServerIp,
    [int]$FrontendPort,
    [int]$ApiPort,
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'deploy.config.ps1')

if (-not $ServerIp) { $ServerIp = $script:WO_APS_SERVER_IP }
if (-not $FrontendPort) { $FrontendPort = $script:WO_APS_FRONTEND_PORT }
if (-not $ApiPort) { $ApiPort = $script:WO_APS_API_PORT }
if (-not $ProjectRoot) { $ProjectRoot = $script:WO_APS_PROJECT_ROOT }

Write-Host '=== Work Order APS - diagnosa server ===' -ForegroundColor Cyan
Write-Host "Config IP   : $ServerIp"
Write-Host "Frontend    : port $FrontendPort"
Write-Host "API         : port $ApiPort"
Write-Host ''

Write-Host '--- Alamat IP mesin ini ---' -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown'
} | ForEach-Object {
    Write-Host ('  {0}  ({1})' -f $_.IPAddress, $_.InterfaceAlias)
}
Write-Host '  >> Client harus pakai IP di atas, BUKAN IP lain' -ForegroundColor Green
Write-Host ''

Write-Host '--- Port yang sedang LISTEN ---' -ForegroundColor Yellow
$ports = @($FrontendPort, $ApiPort)
foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $addr = ($conn | Select-Object -First 1).LocalAddress
        Write-Host ('  Port {0}  LISTEN  ({1})' -f $p, $addr) -ForegroundColor Green
        if ($addr -eq '127.0.0.1') {
            Write-Host '    PERINGATAN: hanya localhost - client LAN tidak bisa akses!' -ForegroundColor Red
            Write-Host ('    Restart: npm run start -- -p {0} -H 0.0.0.0' -f $p) -ForegroundColor Red
        }
    }
    else {
        Write-Host ('  Port {0}  TIDAK ADA service' -f $p) -ForegroundColor Red
    }
}
Write-Host ''

$nextDir = Join-Path $ProjectRoot 'frontend\.next'
if (Test-Path $nextDir) {
    Write-Host '  frontend\.next  ADA (build OK)' -ForegroundColor Green
}
else {
    Write-Host '  frontend\.next  TIDAK ADA - jalankan npm run build' -ForegroundColor Red
}
Write-Host ''

Write-Host '--- Test dari server sendiri ---' -ForegroundColor Yellow
$testUrls = @(
    "http://127.0.0.1:$FrontendPort",
    "http://${ServerIp}:$FrontendPort",
    "http://127.0.0.1:$ApiPort/api/login"
)
foreach ($url in $testUrls) {
    try {
        $r = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5 -UseBasicParsing
        Write-Host ('  OK {0}  HTTP {1}' -f $url, $r.StatusCode) -ForegroundColor Green
    }
    catch {
        $msg = $_.Exception.Message
        if ($msg -match '404|405') {
            Write-Host ('  OK {0}  (server merespons)' -f $url) -ForegroundColor Green
        }
        else {
            Write-Host ('  GAGAL {0}' -f $url) -ForegroundColor Red
            Write-Host "         $msg" -ForegroundColor DarkRed
        }
    }
}
Write-Host ''

Write-Host '--- Firewall (perlu Admin) ---' -ForegroundColor Yellow
$rules = @(Get-NetFirewallRule -ErrorAction SilentlyContinue | Where-Object {
    $_.DisplayName -like '*WO-APS*'
})
if ($rules.Count -gt 0) {
    foreach ($rule in $rules) {
        Write-Host ('  Rule: {0}  Enabled={1}' -f $rule.DisplayName, $rule.Enabled)
    }
}
else {
    Write-Host '  Belum ada rule WO-APS. Jalankan:' -ForegroundColor Red
    Write-Host ('  New-NetFirewallRule -DisplayName "WO-APS Frontend {0}" -Direction Inbound -Protocol TCP -LocalPort {0} -Action Allow' -f $FrontendPort)
    Write-Host ('  New-NetFirewallRule -DisplayName "WO-APS API {0}" -Direction Inbound -Protocol TCP -LocalPort {0} -Action Allow' -f $ApiPort)
}
Write-Host ''
Write-Host '=== Jika port TIDAK LISTEN, jalankan: ===' -ForegroundColor Cyan
Write-Host '  powershell -ExecutionPolicy Bypass -File scripts/start-wo-aps-server.ps1'
