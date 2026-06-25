# UAT Fase 4 — Langkah 2: isi data operasional WO + verifikasi laporan Delay & Unit/Component
# Prasyarat: backend http://127.0.0.1:8000 (php artisan serve), frontend http://localhost:3000
# Login demo: admin / password

param(
    [string]$ApiBase = 'http://127.0.0.1:8000/api',
    [string]$Login = 'admin',
    [string]$Password = 'password',
    [string]$WoNumber = 'WO-ADIKARA-001'
)

$ErrorActionPreference = 'Stop'
$headers = @{ Accept = 'application/json'; 'Content-Type' = 'application/json' }

Write-Host "==> Login ($Login)..." -ForegroundColor Cyan
$authRes = Invoke-RestMethod -Uri "$ApiBase/login" -Method POST -Headers $headers -Body (@{ login = $Login; password = $Password } | ConvertTo-Json)
$auth = @{
    Authorization = "Bearer $($authRes.token)"
    Accept        = 'application/json'
    'Content-Type' = 'application/json'
}

Write-Host "==> Cari WO $WoNumber..." -ForegroundColor Cyan
$list = Invoke-RestMethod -Uri "$ApiBase/work-orders?search=$WoNumber&per_page=20" -Headers $auth
$wo = $list.data | Where-Object { $_.wo_number -eq $WoNumber } | Select-Object -First 1
if (-not $wo) { throw "WO $WoNumber tidak ditemukan. Jalankan: php artisan db:seed" }

$installedAt = (Get-Date).AddYears(-2).ToString('yyyy-MM-dd')
$body = @{
    delay_cause              = 'spare_part'
    delay_notes              = 'UAT Fase 4 - tunggu seal kit'
    component_installed_at   = $installedAt
} | ConvertTo-Json

Write-Host "==> Simpan data operasional (PATCH operational-fields)..." -ForegroundColor Cyan
$updated = Invoke-RestMethod -Uri "$ApiBase/work-orders/$($wo.id)/operational-fields" -Method PATCH -Headers $auth -Body $body
Write-Host "    OK: $($updated.wo_number) delay=$($updated.delay_cause) pasang=$($updated.component_installed_at)" -ForegroundColor Green

Write-Host "==> Verifikasi Delay Analysis..." -ForegroundColor Cyan
$delay = Invoke-RestMethod -Uri "$ApiBase/reports/delay-analysis" -Headers $auth
$inDelay = $delay.work_orders | Where-Object { $_.wo_number -eq $WoNumber }
if (-not $inDelay) { throw "WO tidak muncul di /reports/delay-analysis" }
Write-Host "    OK: $($inDelay.delay_cause_label) (sumber: $($inDelay.source))" -ForegroundColor Green

Write-Host "==> Verifikasi Unit/Component History (komponen)..." -ForegroundColor Cyan
$unit = Invoke-RestMethod -Uri "$ApiBase/reports/unit-component-history?group_by=component" -Headers $auth
$group = $unit.data | Where-Object { $_.last_wo_number -eq $WoNumber -or $_.label -like "*$($updated.component_name)*" } | Select-Object -First 1
if (-not $group) { throw "Grup komponen tidak ditemukan di unit-component-history" }
Write-Host "    OK: $($group.label) | frekuensi=$($group.repair_count) | umur=$([math]::Round($group.component_age_days)) hari" -ForegroundColor Green

Write-Host ""
Write-Host "UAT langkah 2 LULUS (API)." -ForegroundColor Green
Write-Host "UI manual: buka http://localhost:3000/work-orders/$($wo.id) lalu /reports (tab History + Report KPI)." -ForegroundColor Yellow
