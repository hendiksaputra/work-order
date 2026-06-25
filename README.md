# Workshop Work Order System (APS)

Sistem manajemen Work Order workshop berdasarkan alur **WORK ORDER APS.pptx**.

## Stack

- **Backend:** Laravel 12 + Sanctum API (port 8000)
- **Frontend:** Next.js 16 + Tailwind (port 3000)
- **Database:** MySQL via XAMPP (`wo_aps`)

## Fitur

| Modul | Deskripsi |
|-------|-----------|
| Dashboard | Ringkasan WO, pending approval, jam produktif |
| Work Order | Main WO + Sub WO (Rebuild/Fabrication/Support) |
| Mechanic Activity | Working/Stand by, jam kerja, daftar pekerjaan produktif/non-produktif |
| Parts & Consumable | Permintaan part per WO, outstanding jika tidak ada stock |
| Inspection | Approval supervisor untuk WO, aktivitas, parts |
| Reports | Produktivitas, kinerja mekanik, spare parts, lead time |

## Setup XAMPP

1. Start **Apache** dan **MySQL** di XAMPP Control Panel
2. Buat database `wo_aps` di phpMyAdmin (atau jalankan `database/wo_aps_setup.sql`)
3. Backend `.env` sudah dikonfigurasi:
   ```
   DB_DATABASE=wo_aps
   DB_USERNAME=root
   DB_PASSWORD=
   ```

## Menjalankan Aplikasi

```bash
# Terminal 1 - Backend
cd backend
php artisan serve

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Buka: http://localhost:3000

## Deploy ke server LAN (port 3000 bentrok)

Jika port 3000/3001 sudah dipakai (e-letter, dll.), atur port frontend di **`scripts/deploy.config.ps1`** (default **3002**).

Panduan lengkap: [`docs/deployment-server.md`](docs/deployment-server.md)

```powershell
cd C:\xampp\htdocs\work-orders
# opsional: cek port kosong
powershell -ExecutionPolicy Bypass -File scripts\find-free-port.ps1
powershell -ExecutionPolicy Bypass -File scripts\setup-wo-aps-server.ps1
powershell -ExecutionPolicy Bypass -File scripts\start-wo-aps-server.ps1
```

Client akses: **http://192.168.32.15:3002** (sesuai `deploy.config.ps1`, API port **8000**)

## Role & Permission

Setiap role hanya bisa mengakses modul dan aksi yang sesuai alur workshop:

| Role | Bisa | Tidak bisa |
|------|------|------------|
| **planner** | Buat/submit WO, parts request, lihat reports | Approve, inspection, input aktivitas |
| **supervisor** | Approve WO/aktivitas/parts, inspection, reports | Buat WO, input aktivitas, logistic |
| **mechanic** | Input aktivitas sendiri, parts request sendiri, lihat WO | Buat WO, approve, reports, inspection |
| **logistic** | Cek & ambil parts yang sudah di-approve | Buat WO, aktivitas, approve, reports |
| **admin** | Semua akses | — |

API mengembalikan `403` jika role mencoba aksi terlarang. UI menyembunyikan menu dan tombol yang tidak diizinkan.

## Akun Demo (password: `password`)

| Email | Role |
|-------|------|
| admin@aps.local | Admin |
| planner@aps.local | Service Analyst / Planner |
| supervisor@aps.local | Supervisor |
| mekanik1@aps.local | Mechanic |
| logistic@aps.local | Logistic |

## Alur WO

```
WO Created → Supervisor Approval → Execution → QC → Final Approval → Closed
```

Work Details pada WO terisi otomatis dari **Mechanic Activity** dan **Parts Consumption** yang sudah disetujui.
