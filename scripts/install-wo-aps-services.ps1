# Install WO APS sebagai Windows Service (tetap jalan walau terminal ditutup + auto-start saat boot)
# Jalankan PowerShell AS ADMINISTRATOR di server.

#Requires -RunAsAdministrator

param(
    [string]$ProjectRoot,
    [int]$FrontendPort,
    [int]$ApiPort,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'deploy.config.ps1')

if (-not $ProjectRoot) { $ProjectRoot = $script:WO_APS_PROJECT_ROOT }
if (-not $FrontendPort) { $FrontendPort = $script:WO_APS_FRONTEND_PORT }
if (-not $ApiPort) { $ApiPort = $script:WO_APS_API_PORT }

$backend = Join-Path $ProjectRoot 'backend'
$frontendDeploy = Join-Path $ProjectRoot 'deploy\wo-aps-frontend'
$logs = Join-Path $ProjectRoot 'logs'
$serverJs = Join-Path $frontendDeploy 'server.js'

function Get-NssmExecutable {
    $candidates = @(
        (Join-Path $PSScriptRoot 'nssm\win64\nssm.exe'),
        (Join-Path $PSScriptRoot 'nssm\nssm.exe'),
        'C:\nssm\win64\nssm.exe',
        'C:\nssm\nssm.exe'
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return (Resolve-Path $path).Path }
    }
    $cmd = Get-Command nssm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Ensure-Nssm {
    $existing = Get-NssmExecutable
    if ($existing) { return $existing }

    $zipUrl = 'https://nssm.cc/release/nssm-2.24.zip'
    $toolsDir = Join-Path $PSScriptRoot 'nssm'
    $zipPath = Join-Path $env:TEMP 'nssm-2.24.zip'

    Write-Host 'NSSM belum ada. Mengunduh NSSM 2.24 ...' -ForegroundColor Yellow
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $toolsDir -Force
    Remove-Item $zipPath -Force

    $exe = Get-NssmExecutable
    if (-not $exe) {
        throw "NSSM gagal diunduh. Salin manual nssm.exe ke scripts\nssm\win64\ lalu jalankan ulang."
    }
    return $exe
}

function Install-WoApsService {
    param(
        [string]$Nssm,
        [string]$ServiceName,
        [string]$Application,
        [string]$Arguments,
        [string]$AppDirectory,
        [hashtable]$Environment = @{},
        [string]$StdoutLog,
        [string]$StderrLog
    )

    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing -and -not $Force) {
        Write-Host "Service $ServiceName sudah ada. Gunakan -Force untuk pasang ulang." -ForegroundColor Yellow
        return
    }

    if ($existing) {
        & $Nssm stop $ServiceName 2>$null | Out-Null
        Start-Sleep -Seconds 2
        & $Nssm remove $ServiceName confirm 2>$null | Out-Null
        Start-Sleep -Seconds 1
    }

    & $Nssm install $ServiceName $Application $Arguments | Out-Null
    & $Nssm set $ServiceName AppDirectory $AppDirectory | Out-Null
    & $Nssm set $ServiceName AppStdout $StdoutLog | Out-Null
    & $Nssm set $ServiceName AppStderr $StderrLog | Out-Null
    & $Nssm set $ServiceName AppStdoutCreationDisposition 4 | Out-Null
    & $Nssm set $ServiceName AppStderrCreationDisposition 4 | Out-Null
    & $Nssm set $ServiceName AppRotateFiles 1 | Out-Null
    & $Nssm set $ServiceName AppRotateBytes 1048576 | Out-Null
    & $Nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
    & $Nssm set $ServiceName DisplayName $ServiceName | Out-Null
    & $Nssm set $ServiceName Description 'Work Order APS - jalankan otomatis di server' | Out-Null
    & $Nssm set $ServiceName AppExit Default Restart | Out-Null
    & $Nssm set $ServiceName AppRestartDelay 5000 | Out-Null

    foreach ($key in $Environment.Keys) {
        & $Nssm set $ServiceName AppEnvironmentExtra "$key=$($Environment[$key])" | Out-Null
    }

    Write-Host "  + Service $ServiceName terpasang" -ForegroundColor Green
}

if (-not (Test-Path (Join-Path $backend 'artisan'))) {
    throw "Folder backend tidak ditemukan: $backend"
}
if (-not (Test-Path $serverJs)) {
    throw "Paket frontend standalone tidak ada: $serverJs`nBuild di PC dev lalu copy deploy\wo-aps-frontend ke server."
}

$null = (Get-Command php -ErrorAction Stop).Source
$null = (Get-Command node -ErrorAction Stop).Source
$powershell = (Get-Command powershell -ErrorAction Stop).Source
$nssm = Ensure-Nssm

$apiScript = Join-Path $PSScriptRoot 'run-api-service.ps1'
$frontendScript = Join-Path $PSScriptRoot 'run-frontend-service.ps1'

New-Item -ItemType Directory -Force -Path $logs | Out-Null

Write-Host '==> Install WO APS Windows Services' -ForegroundColor Cyan
Write-Host "    Project : $ProjectRoot"
Write-Host "    API     : port $ApiPort"
Write-Host "    Frontend: port $FrontendPort"
Write-Host "    NSSM    : $nssm"
Write-Host ''

Install-WoApsService -Nssm $nssm -ServiceName 'WO-APS-API' `
    -Application $powershell `
    -Arguments "-ExecutionPolicy Bypass -NoProfile -File `"$apiScript`"" `
    -AppDirectory $ProjectRoot `
    -StdoutLog (Join-Path $logs 'api-out.log') `
    -StderrLog (Join-Path $logs 'api-err.log')

Install-WoApsService -Nssm $nssm -ServiceName 'WO-APS-Frontend' `
    -Application $powershell `
    -Arguments "-ExecutionPolicy Bypass -NoProfile -File `"$frontendScript`"" `
    -AppDirectory $ProjectRoot `
    -StdoutLog (Join-Path $logs 'frontend-out.log') `
    -StderrLog (Join-Path $logs 'frontend-err.log')

Write-Host ''
Write-Host 'Menjalankan service ...' -ForegroundColor Cyan
Start-Service 'WO-APS-API'
Start-Sleep -Seconds 3
Start-Service 'WO-APS-Frontend'

Write-Host ''
Write-Host 'Selesai. Service berjalan di background.' -ForegroundColor Green
Write-Host '  Kelola: powershell -File scripts\manage-wo-aps-services.ps1 -Action status'
Write-Host '  Log   : folder logs\'
Write-Host ''
Write-Host 'Client: http://' -NoNewline -ForegroundColor Green
Write-Host "$($script:WO_APS_SERVER_IP):$FrontendPort" -ForegroundColor Green
