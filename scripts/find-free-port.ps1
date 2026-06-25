# Cari port TCP kosong di server (untuk frontend Next.js)
param(
    [int[]]$Candidates = @(3002, 3003, 3004, 3005, 3010, 3080, 3100),
    [string]$BindAddress = '0.0.0.0'
)

function Test-PortFree([int]$Port) {
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Parse(
                if ($BindAddress -eq '0.0.0.0') { '0.0.0.0' } else { $BindAddress }
            ),
            $Port
        )
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    } finally {
        if ($listener) { try { $listener.Stop() } catch {} }
    }
}

Write-Host "Memeriksa port kandidat..." -ForegroundColor Cyan
foreach ($p in $Candidates) {
    $free = Test-PortFree $p
    $status = if ($free) { 'KOSONG' } else { 'TERPAKAI' }
    $color = if ($free) { 'Green' } else { 'Red' }
    Write-Host ("  {0,-6} {1}" -f $p, $status) -ForegroundColor $color
}

$first = $Candidates | Where-Object { Test-PortFree $_ } | Select-Object -First 1
if ($first) {
    Write-Host ""
    Write-Host "Rekomendasi: port $first" -ForegroundColor Green
    Write-Host "Edit scripts\deploy.config.ps1 -> WO_APS_FRONTEND_PORT = $first"
} else {
    Write-Host ""
    Write-Host "Tidak ada port kosong dari daftar kandidat. Tambah angka di parameter -Candidates." -ForegroundColor Yellow
}
