# Dipanggil oleh Windows Service (NSSM) — jangan tutup manual
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'deploy.config.ps1')

$deploy = Join-Path $script:WO_APS_PROJECT_ROOT 'deploy\wo-aps-frontend'
$env:PORT = $script:WO_APS_FRONTEND_PORT
$env:HOSTNAME = '0.0.0.0'
$env:API_BACKEND_URL = "http://127.0.0.1:$($script:WO_APS_API_PORT)"

Set-Location $deploy
& node server.js
