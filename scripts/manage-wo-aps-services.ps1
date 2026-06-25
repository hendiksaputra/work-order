# Start / stop / restart / status service WO APS
# Contoh: powershell -File scripts\manage-wo-aps-services.ps1 -Action restart

param(
    [ValidateSet('start', 'stop', 'restart', 'status')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$services = @('WO-APS-API', 'WO-APS-Frontend')

function Show-Status {
    foreach ($name in $services) {
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if (-not $svc) {
            Write-Host "  $name  BELUM TERPASANG" -ForegroundColor Red
            continue
        }
        $color = if ($svc.Status -eq 'Running') { 'Green' } else { 'Yellow' }
        Write-Host "  $name  $($svc.Status)" -ForegroundColor $color
    }
}

switch ($Action) {
    'start' {
        Write-Host 'Starting WO APS services ...' -ForegroundColor Cyan
        foreach ($name in $services) {
            $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
            if ($svc) { Start-Service $name }
        }
        Show-Status
    }
    'stop' {
        Write-Host 'Stopping WO APS services ...' -ForegroundColor Cyan
        [array]::Reverse($services)
        foreach ($name in $services) {
            $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
            if ($svc -and $svc.Status -eq 'Running') { Stop-Service $name -Force }
        }
        Show-Status
    }
    'restart' {
        & $PSCommandPath -Action stop
        Start-Sleep -Seconds 2
        & $PSCommandPath -Action start
    }
    'status' {
        Write-Host 'WO APS service status:' -ForegroundColor Cyan
        Show-Status
    }
}
