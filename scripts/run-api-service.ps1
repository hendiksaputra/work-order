# Dipanggil oleh Windows Service (NSSM) — jangan tutup manual
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'deploy.config.ps1')

$backend = Join-Path $script:WO_APS_PROJECT_ROOT 'backend'
Set-Location $backend

& php artisan serve --host=0.0.0.0 --port=$script:WO_APS_API_PORT
