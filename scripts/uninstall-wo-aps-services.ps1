# Hapus Windows Service WO APS
# Jalankan PowerShell AS ADMINISTRATOR.

#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'deploy.config.ps1')

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

$nssm = Get-NssmExecutable
$services = @('WO-APS-Frontend', 'WO-APS-API')

foreach ($name in $services) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-Host "$name tidak ada, dilewati." -ForegroundColor Gray
        continue
    }

    if ($svc.Status -eq 'Running') {
        Stop-Service $name -Force
    }

    if ($nssm) {
        & $nssm remove $name confirm | Out-Null
    }
    else {
        sc.exe delete $name | Out-Null
    }

    Write-Host "Service $name dihapus." -ForegroundColor Green
}

Write-Host 'Selesai. Jalankan manual lagi dengan start-wo-aps-server.ps1 jika perlu.' -ForegroundColor Cyan
