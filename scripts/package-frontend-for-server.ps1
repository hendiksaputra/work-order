# Jalankan di PC DEVELOPMENT (bukan server) setelah npm install + build berhasil.
# Hasil: folder deploy\wo-aps-frontend siap di-copy ke server tanpa npm install.

param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
$frontend = Join-Path $ProjectRoot 'frontend'
$standalone = Join-Path $frontend '.next\standalone'
$static = Join-Path $frontend '.next\static'
$public = Join-Path $frontend 'public'
$out = Join-Path $ProjectRoot 'deploy\wo-aps-frontend'

if (-not (Test-Path (Join-Path $frontend '.next'))) {
    throw 'Belum ada build. Di folder frontend jalankan: npm run build'
}
if (-not (Test-Path $standalone)) {
    throw 'Build standalone tidak ditemukan. Pastikan next.config.ts punya output: standalone lalu npm run build ulang.'
}

Write-Host '==> Packaging frontend standalone...' -ForegroundColor Cyan

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Path $out | Out-Null

Copy-Item -Recurse -Force (Join-Path $standalone '*') $out
New-Item -ItemType Directory -Path (Join-Path $out '.next') -Force | Out-Null
Copy-Item -Recurse -Force $static (Join-Path $out '.next\static')
if (Test-Path $public) {
    Copy-Item -Recurse -Force $public (Join-Path $out 'public')
}

# Verifikasi build tidak masih pakai localhost
$chunk = Get-ChildItem (Join-Path $out '.next\static\chunks') -Filter '*.js' -ErrorAction SilentlyContinue |
    Select-Object -First 5
foreach ($f in $chunk) {
    $c = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
    if ($c -match 'localhost:8000') {
        Write-Warning 'PERINGATAN: build masih mengandung localhost:8000. Rebuild dengan .env.production NEXT_PUBLIC_API_URL=/api'
    }
}

$sizeMb = [math]::Round((Get-ChildItem $out -Recurse | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "Selesai: $out ($sizeMb MB)" -ForegroundColor Green
Write-Host ''
Write-Host 'Langkah server:' -ForegroundColor Yellow
Write-Host '  1. Copy folder deploy\wo-aps-frontend ke C:\xampp\htdocs\work-orders\deploy\wo-aps-frontend'
Write-Host '  2. Pastikan Laravel API jalan di 127.0.0.1:8000'
Write-Host '  3. powershell -File scripts\start-frontend-standalone.ps1'
