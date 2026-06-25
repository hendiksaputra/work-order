# Deploy ke Server LAN (XAMPP Windows)

Contoh: server **192.168.32.15**, folder **`C:\xampp\htdocs\work-orders`**.

Port yang sudah terpakai di server ini:
- **3000** — e-letter
- **3001** — aplikasi lain

Default Work Order APS: **port 3002** (frontend).

## Arsitektur akses client

| Service | URL client | Port |
|---------|------------|------|
| Frontend (Next.js) | `http://192.168.32.15:3002` | **3002** (atur di `deploy.config.ps1`) |
| API (Laravel) | `http://192.168.32.15:8000/api` | **8000** |
| MySQL | hanya lokal server | 3306 |

Browser client memanggil API langsung ke IP server — **jangan** pakai `localhost` di `.env` production.

## Konfigurasi port (edit sekali)

File: **`scripts/deploy.config.ps1`**

```powershell
$script:WO_APS_SERVER_IP = '192.168.32.15'
$script:WO_APS_FRONTEND_PORT = 3002   # ganti jika bentrok
$script:WO_APS_API_PORT = 8000
$script:WO_APS_PROJECT_ROOT = 'C:\xampp\htdocs\work-orders'
```

Cek port kosong:

```powershell
cd C:\xampp\htdocs\work-orders
powershell -ExecutionPolicy Bypass -File scripts\find-free-port.ps1
```

## Setup sekali (di server)

1. Start **MySQL** di XAMPP (database `wo_aps` sudah di-import).
2. Edit `scripts\deploy.config.ps1` jika perlu.
3. PowerShell **as Administrator**:

```powershell
cd C:\xampp\htdocs\work-orders
powershell -ExecutionPolicy Bypass -File scripts\setup-wo-aps-server.ps1
```

4. Edit `backend\.env` (sesuaikan **port frontend** dengan `deploy.config.ps1`):

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=http://192.168.32.15:8000

DB_DATABASE=wo_aps
DB_USERNAME=root
DB_PASSWORD=

CORS_ALLOWED_ORIGINS=http://192.168.32.15:3002,http://localhost:3002
SANCTUM_STATEFUL_DOMAINS=192.168.32.15:3002,localhost:3002
```

```powershell
cd backend
php artisan config:clear
```

5. `frontend\.env.production` (dibuat otomatis oleh setup):

```env
NEXT_PUBLIC_API_URL=http://192.168.32.15:8000/api
PORT=3002
HOSTNAME=0.0.0.0
```

Jika mengubah port atau API URL, jalankan ulang `npm run build` di folder `frontend`.

## Menjalankan (setiap server restart)

### Opsi A — Manual (terminal harus tetap terbuka)

```powershell
cd C:\xampp\htdocs\work-orders
powershell -ExecutionPolicy Bypass -File scripts\start-wo-aps-server.ps1
```

**Catatan:** Tutup jendela PowerShell = aplikasi berhenti.

### Opsi B — Background (terminal boleh ditutup, hilang saat reboot)

```powershell
cd C:\xampp\htdocs\work-orders
powershell -ExecutionPolicy Bypass -File scripts\start-wo-aps-background.ps1
```

Proses berjalan terpisah di background. Log ada di folder `logs\`.

### Opsi C — Windows Service (disarankan production)

Tetap jalan walau terminal ditutup **dan** auto-start saat server boot.

**Sekali pasang** (PowerShell **Run as Administrator**):

```powershell
cd C:\xampp\htdocs\work-orders
powershell -ExecutionPolicy Bypass -File scripts\install-wo-aps-services.ps1
```

Script akan mengunduh **NSSM** otomatis (jika belum ada) dan membuat 2 service:

| Service | Fungsi |
|---------|--------|
| `WO-APS-API` | Laravel `php artisan serve` port 8000 |
| `WO-APS-Frontend` | Next.js standalone port 3002 |

**Kelola service:**

```powershell
# Cek status
powershell -File scripts\manage-wo-aps-services.ps1 -Action status

# Restart setelah deploy update
powershell -File scripts\manage-wo-aps-services.ps1 -Action restart

# Stop / start
powershell -File scripts\manage-wo-aps-services.ps1 -Action stop
powershell -File scripts\manage-wo-aps-services.ps1 -Action start
```

**Hapus service** (kembali ke mode manual):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\uninstall-wo-aps-services.ps1
```

**Cek dari Services Windows:** `Win + R` → `services.msc` → cari `WO-APS-API` dan `WO-APS-Frontend`.

**Log service:** `C:\xampp\htdocs\work-orders\logs\` (`api-out.log`, `frontend-out.log`, dll.)

Client akses: **http://192.168.32.13:3002** (sesuai `WO_APS_FRONTEND_PORT`)

Login demo: `admin` / `password`

## Firewall Windows

Ganti `3002` jika pakai port lain:

```powershell
New-NetFirewallRule -DisplayName "WO-APS Frontend 3002" -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow
New-NetFirewallRule -DisplayName "WO-APS API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

## Auto-start saat boot

Gunakan **Opsi C** di atas (`install-wo-aps-services.ps1` + NSSM). Service diset `SERVICE_AUTO_START`.

Alternatif lain: PM2 for Windows — kurang disarankan untuk `php artisan serve`; NSSM lebih stabil di XAMPP Windows.

## Deploy TANPA npm install di server (disarankan)

Jika `npm install` di server **lama/macet seharian**, build di PC development lalu copy paket standalone:

**Di PC development** (yang npm-nya normal):

```powershell
cd frontend
npm run build
cd ..
powershell -ExecutionPolicy Bypass -File scripts\package-frontend-for-server.ps1
```

Copy folder `deploy\wo-aps-frontend` ke server:
`C:\xampp\htdocs\work-orders\deploy\wo-aps-frontend`

Browser memanggil `/api` lewat proxy Next.js → Laravel di `127.0.0.1:8000` (tidak perlu `NEXT_PUBLIC_API_URL` di server).

**Di server** (hanya butuh Node.js, tanpa npm install):

```powershell
# Terminal 1 - API (sama seperti biasa)
cd C:\xampp\htdocs\work-orders\backend
php artisan serve --host=0.0.0.0 --port=8000

# Terminal 2 - Frontend standalone
powershell -ExecutionPolicy Bypass -File scripts\start-frontend-standalone.ps1
```

Client: **http://192.168.32.13:3002**

## Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| `npm install` spinner berjam-jam | Jaringan/registry lambat atau macet | **Pakai standalone deploy** (atas), atau mirror `npm config set registry https://registry.npmmirror.com` |
| `next` is not recognized | node_modules tidak ada | Standalone deploy ATAU `npx next start` setelah install |
| `EADDRINUSE` / port sudah dipakai | 3001/3002 bentrok | `find-free-port.ps1`, ubah `deploy.config.ps1` |
| `npm error ENOENT ... oxide-wasm32-wasi` | npm di Git Bash MINGW64 | Pakai PowerShell + `install-frontend-windows.ps1` |
| Halaman tidak buka dari PC lain | Firewall / bind localhost | `-H 0.0.0.0`, buka firewall |
| Login gagal / Failed to fetch | API masih `localhost` | Rebuild dengan `NEXT_PUBLIC_API_URL` IP server |
| CORS error | Origin tidak diizinkan | Update `CORS_ALLOWED_ORIGINS` + port yang benar, `config:clear` |
| 500 API | APP_KEY / DB | `php artisan key:generate`, cek MySQL |

### Fix npm `oxide-wasm32-wasi` (Windows)

```powershell
cd C:\xampp\htdocs\work-orders
powershell -ExecutionPolicy Bypass -File scripts\install-frontend-windows.ps1
```

## Alternatif: satu URL tanpa port (Apache)

Reverse proxy Apache ke port frontend (mis. 3002) — konfigurasi `httpd-vhosts.conf` terpisah.
