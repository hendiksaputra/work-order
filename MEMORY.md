# Memory

## 2026-05-19 — WO APS jalan permanen di server Windows (NSSM)

- Terminal ditutup = proses mati jika pakai `php artisan serve` / `node server.js` langsung di foreground.
- **Opsi cepat:** `scripts\start-wo-aps-background.ps1` — proses terpisah, terminal boleh ditutup (hilang saat reboot).
- **Opsi production:** `scripts\install-wo-aps-services.ps1` (Admin) — Windows Service `WO-APS-API` + `WO-APS-Frontend`, auto-start boot.
- Kelola: `manage-wo-aps-services.ps1 -Action status|restart|stop|start`
- Log: `logs\api-out.log`, `logs\frontend-out.log`

## 2026-05-19 — Permission Sub WO (create / edit / delete)

- Permission baru: `work_orders.sub.create`, `work_orders.sub.edit`, `work_orders.sub.delete`.
- **Main WO** tetap memakai `work_orders.create`, `work_orders.update`, `work_orders.delete_any_status`.
- **Sub WO** bisa dikelola lewat permission khusus; `work_orders.create` / `work_orders.update` tetap berlaku sebagai fallback (backward compat).
- Default matrix: planner dapat ketiga permission sub; supervisor dapat `sub.edit` + `sub.delete` (hapus Sub WO tanpa `work_orders.update`).
- Backend: `WorkOrderController::store` cek tipe; `canEditWorkOrder` / `canDeleteWorkOrder` membedakan main vs sub.
- Frontend: `work-order-access.ts` — `canCreateMainWorkOrder`, `canCreateSubWorkOrder`; modal create menampilkan tipe sesuai permission.
- Migration: `2026_05_19_120000_add_sub_work_order_permissions.php` — jalankan `php artisan migrate` di server.

## 2026-05-19 — Hapus Sub WO dari daftar Work Order

- Main WO dengan Sub WO: tombol hapus Main dinonaktifkan sampai semua Sub WO dihapus.
- Panel **Main/Sub WO** (expand kolom hierarki): tiap Sub WO punya tombol **Hapus** (+ Edit) sesuai permission.
- File: `WorkOrderHierarchyTree.tsx`, `work-orders/page.tsx`.

## 2026-05-19 — Initial build

- Aplikasi dibangun dari **WORK ORDER APS.pptx** dengan stack Laravel 12 + Next.js 16 + MySQL XAMPP.
- Database: `wo_aps`, default XAMPP `root` tanpa password.
- Demo password semua user: `password`.
- Sub WO nomor prefix `SWO-ADIKARA-XXX`, Main WO `WO-ADIKARA-XXX`.
- Kategori `other` pada Main WO berdiri sendiri (tanpa sub WO) sesuai PPT.

## 2026-05-19 — Strict RBAC

- Permission matrix di `Permission.php` / `permissions.ts` — harus tetap sinkron.
- Mekanik hanya lihat aktivitas & parts milik sendiri; logistic hanya proses parts setelah supervisor approve.
- Aktivitas `working` ditolak jika WO masih `draft`/`closed`/`rejected`.

## 2026-05-19 — Dashboard "Failed to fetch"

- **Root cause:** `User::can(string)` bentrok dengan `Illuminate\Foundation\Auth\Access\Authorizable::can($abilities, $arguments)` → PHP fatal error pada request terautentikasi; browser menampilkan `TypeError: Failed to fetch` / CORS tanpa header.
- **Fix:** Ganti ke `User::hasPermission(string)` di model, middleware, dan controller.
- Backend harus berjalan: `php artisan serve --host=127.0.0.1 --port=8000` (sesuai `NEXT_PUBLIC_API_URL` di frontend).

## 2026-05-19 — Admin: Users & Role/Permission

- Tabel `roles`, `permissions`, `role_permission` — matrix disimpan di DB, di-seed dari `Permission::matrix()`.
- Admin users: `admin@aps.local`, `administrator@aps.local` (password: `password`).
- Menu: **Pengguna** (`/settings/users`), **Role & Permission** (`/settings/roles`) — hanya role admin (permission `users.*`, `roles.*`).
- Setelah ubah permission role, user harus **login ulang** agar token/localStorage ter-update.

## 2026-05-22 — WO edit/hapus semua status (admin)

- Permission baru: `work_orders.edit_any_status`, `work_orders.delete_any_status` — assignable di Role & Permission (admin punya semua via matrix).
- Mechanic Activity: `mechanic_activities.update` / `delete` (draft milik sendiri), `edit_any_status` / `delete_any_status` (admin). Edit/hapus approved memicu `WorkOrder::refreshWorkDetails()`.
- Parts Request: `parts_requests.update` / `delete` (draft milik sendiri), `edit_any_status` / `delete_any_status` (admin). Edit/hapus status approved/logistic/taken memicu `refreshWorkDetails()`.
- Supervisor (`parts_requests.supervisor`): Approve/Reject di `/parts` untuk status `pending_approval` (API `POST .../supervisor`); juga tersedia di `/inspection`. Supervisor tidak punya create/edit/delete parts di matrix.
- Users import Excel: `GET /api/users/import/template`, `POST /api/users/import` (`.xlsx`, `.csv`). Permission `users.import`. Wajib Nama+Role; Username/Email/NIK opsional (auto-generate). Password kosong → `password`.
- Role permission (`/settings/roles`): jika role ada di tabel `roles`, `User::permissionNames()` memakai **hanya** permission DB (bukan merge dengan matrix default). Hapus Parts dari role Mekanik di UI → mekanik tidak lihat menu `/parts`.
- Kolom `users.username` (unique). Login pakai email atau username. Demo: `admin`, `supervisor`, `planner`, dll.
- Sidebar menu Work Order: badge jumlah WO belum disetujui untuk user dengan `work_orders.approve` (status `pending_supervisor` + draft WO buatan supervisor). Scope model: `WorkOrder::pendingSupervisorApproval()`. API: `GET /work-orders/pending-approval-count`. Event refresh: `wo-pending-count-changed`.
- Sidebar menu Parts & Consumable: badge jumlah `pending_approval` untuk user dengan `parts_requests.supervisor`. API: `GET /parts-requests/pending-approval-count`. Event refresh: `parts-pending-count-changed`.
- Sidebar menu Mechanic Activity: badge jumlah `pending_approval` untuk user dengan `mechanic_activities.approve`. API: `GET /mechanic-activities/pending-approval-count`. Event: `activities-pending-count-changed`.
- `/activities` daftar aktivitas: filter Main WO + Sub WO menampilkan aktivitas **semua mekanik** pada Sub WO yang sama (`GET /mechanic-activities?work_order_id=`). Tanpa filter Sub WO, mekanik hanya lihat aktivitas sendiri. Sub WO harus sudah disetujui supervisor.
- Work Order Body Details: komponen `WorkOrderBodyDetails` — tabel JOB ACTIVITY (group by activity type), PART & CONSUMABLE, LIST CREW/TEAM dari aktivitas/parts approved. Tampil di `/work-orders` (expand Detail) dan `/work-orders/[id]`.
- Progress Main WO: `MainWoSubProgressBar` — % Sub WO selesai (status ≥ `in_execution` setelah Finish). Tampil di kolom No WO (Main) dan panel hierarki Main/Sub WO; otomatis berubah saat Sub WO ditambah/selesai.
- Work Details Main WO: `woMechanicActivities` / `woPartsRequests` mengagregasi data dari semua Sub WO. API `show` memuat `subWorkOrders.mechanicActivities` dan `subWorkOrders.partsRequests`.
- `/reports` Fase 1: tab **History** (WO history + mechanic activity history) dan **Report KPI** (productivity, lead time actual vs target, mechanic performance, spare parts). API: `work-order-history`, `mechanic-activity-history`.
- `/reports` Fase 3 — **Cost Report**: tab biaya, API `GET /reports/cost`. Material = Σ(qty×unit_cost) parts approved/logistic/taken per WO. Labor = Σ jam aktivitas approved × tarif labor. Summary + tabel per WO diurutkan total biaya.
- **Tarif labor (admin UI):** menu **Pengaturan Workshop** (`/settings/workshop`), permission `settings.manage` (admin). Tabel `app_settings` key `labor_hourly_rate`. API: `GET/PUT /api/settings/workshop`. `AppSetting::laborHourlyRate()` — DB dulu, fallback `config/wo_aps.php` + `.env` `WO_LABOR_HOURLY_RATE`.
- `/reports` Fase 4: **Unit/Component History** (tab History) — grup per `unit` atau `component`, frekuensi perbaikan, umur komponen dari `component_installed_at`. **Delay Analysis** — `delay_cause` manual + inferensi spare outstanding / jam aktual >110% target. **Utilization** — jam approved vs kapasitas (`standard_hours_per_day` di Pengaturan Workshop). Kolom WO: `delay_cause`, `delay_notes`, `component_installed_at`. Input: panel di detail WO, `PATCH .../operational-fields` (supervisor/planner/admin).
- **Bug fix:** `ReportController` wajib `use Illuminate\Http\Request` — tanpa import, endpoint history error 500 (PHP resolve `Request` ke namespace `Api\Request`).
- Planner tetap hanya edit/hapus WO **draft/rejected** lewat `work_orders.update`.
- **Bug fix bulk hapus user:** `GET /users/deletable-count` harus didaftarkan **sebelum** `GET /users/{user}` — jika tidak, route `{user}` menangkap `deletable-count`, count gagal, frontend memblokir hapus massal (count=0).
- **Alur tutup WO (UX):** Supervisor menaikkan status bertahap lewat tombol kontekstual (`work-order-status-flow.ts`, `WorkOrderWorkflowActions`). Label per tahap: Setujui WO → Mulai Eksekusi → Kirim ke QC → Setujui QC → **Tutup Work Order** (status `closed`, `closed_at` terisi). Tolak hanya saat `pending_supervisor`. Daftar WO (`/work-orders`) ikut menampilkan aksi lanjut (ikon gembok untuk tutup).

## 2026-05-22 — Middleware permission multi-value

- **Bug:** `permission:a,b,c` di route Laravel hanya meneruskan parameter **pertama** (`a`) ke `CheckPermission` — Supervisor gagal akses `/mechanic-activities` meski punya `view_all`.
- **Fix:** Multi-permission pakai pipe: `permissionAny([...])` → `permission:a|b|c`; `CheckPermission` explode `|`.

## 2026-05-20 — Tabel OITM (master unit)

- Tabel `OITM`: `U_MIS_UnitNo`, `U_MIS_ModeNo` (+ `id`, timestamps).
- Model `App\Models\Oitm`, seeder `OitmSeeder` (data contoh unit/model).
- Menu **Input Unit** (`/units`) di bawah History & Reports — CRUD via API `/api/oitm`. Permission: `oitm.view`, `oitm.manage` (admin & planner).
- Import/Export Excel OITM: `GET /api/oitm/export`, `GET /api/oitm/template`, `POST /api/oitm/import` (`.xlsx`, `.csv`). Paket: `shuchkin/simplexlsx`, `simplexlsxgen`.
- Import skip: baris kosong seluruhnya, kolom `U_MIS_UnitNo`/`U_MIS_ModeNo` kosong/tidak lengkap, dan duplikat — tidak masuk database.

## 2026-06-10 — Ex Unit lookup untuk Supervisor (buat WO)

- Dropdown **Ex Unit** memanggil `GET /api/oitm/lookup` yang sebelumnya hanya `oitm.view` (Planner punya, Supervisor tidak).
- **Fix:** route lookup/unit-numbers boleh diakses dengan `oitm.view` **atau** `work_orders.create` **atau** `work_orders.update`. Matrix default Supervisor ditambah `oitm.view`.
- Jika Supervisor sudah dikustom di Role & Permission, cukup permission buat/edit WO — atau tambahkan **Lihat Master Unit (OITM)** lalu login ulang.

## 2026-06-10 — WO Man Power & Estimasi Jam: Planner read-only

- Field **Jumlah Man Power** dan **Estimasi Jam Kerja** di modal Create/Edit WO read-only untuk Planner (dan role tanpa `work_orders.approve`).
- Hanya **Supervisor** (`WORK_ORDERS_APPROVE`) dan **admin** yang bisa mengisi; backend `WorkOrderController` strip field tersebut dari request non-supervisor.

## 2026-06-10 — Create WO: Ex Unit input manual

- Field **Ex Unit** / **Unit** di modal Create WO (`OitmExUnitSearch` + `SearchableSelect allowFreeText`) sekarang bisa diketik langsung tanpa memilih dari daftar OITM.
- Jika memilih dari daftar, **Unit Model** tetap terisi otomatis; jika ketik manual, Unit Model bisa diisi sendiri (tidak lagi readonly).

## 2026-06-10 — Bug fix refresh tabel Users setelah edit

- **Gejala:** `/settings/users` — setelah simpan modal edit, tabel masih menampilkan data lama sampai refresh halaman penuh.
- **Penyebab:** Beberapa `load()` bersamaan (efek debounce search + efek pagination) bisa saling timpa; `load(page)` setelah save tidak menunggu selesai dan tidak update state lokal.
- **Fix (`settings/users/page.tsx`):** sequence guard pada request `load`, `mergeUserInList()` optimistic setelah PUT, `reloadCurrentPage()` await setelah mutasi, debounce search skip mount awal & tidak re-trigger saat `applyFiltersNow` berubah identitas.

## 2026-06-10 — Tampilan hierarki Main WO & Sub WO

- Komponen `WorkOrderHierarchyTree.tsx` — tree seperti PPT: **Main WO** → baris utama, **Sub WO** dengan garis vertikal + panah `→` per anak.
- Dipakai di `/work-orders` (baris di bawah Main WO) dan `/work-orders/[id]` panel **Struktur Main WO & Sub WO**.
- Sub WO tidak duplikat di tabel jika parent Main WO ada di halaman yang sama.
- API `show`: eager load `parent.subWorkOrders`; relasi `subWorkOrders` diurut `wo_number`.

## 2026-06-10 — WO dibuat Supervisor: tanpa Ajukan ke Supervisor

- WO dengan `creator.role === 'supervisor'` tidak menampilkan tombol **Ajukan ke Supervisor** (`canSubmitWorkOrder` + guard API `submit`).
- Supervisor menyetujui langsung dari status **draft** lewat **Setujui WO** (`canAdvanceWorkOrder` + API `approve` map `draft → approved`).
- File: `work-order-access.ts`, `work-order-status-flow.ts`, `WorkOrderController.php`.

## 2026-06-11 — Lembur setelah jam 18:00 (Mechanic Activity)

- Jam kerja normal berakhir **18:00** (`WorkshopSchedule::STANDARD_WORK_END`).
- Melewati 18:00 wajib **Ajukan Lembur** → supervisor approve di Inspection.
- Tabel `overtime_requests`; API `/overtime-requests`, `/status`, approve.
- Simpan aktivitas: split kerja normal + segmen lembur (catatan `Lembur (disetujui supervisor)`).
- Frontend: `OvertimeRequestPanel.tsx`, blok simpan tanpa approval lembur.

## 2026-06-11 — Jam istirahat otomatis + sesi pagi/siang (Mechanic Activity)

- **Senin–Kamis:** 12:00–13:00 · **Jumat:** 12:00–13:30 (berdasarkan `activity_date`).
- **Berhenti saat istirahat tanpa lanjut siang:** simpan → kerja pagi + istirahat **penuh** tercatat, tidak ada jam kerja siang fiktif.
- **Lanjut setelah istirahat:** wajib tombol **Mulai Kerja Siang** setelah jam istirahat berakhir → `start_time` = jam aktual saat tombol ditekan (bukan jadwal 13:00), terlihat keterlambatan (+X menit).
- State: `wo_mechanic_pending_afternoon`, `wo_mechanic_afternoon_start`; komponen `AfternoonStartPanel.tsx`.
- **Satu simpan melewati istirahat sampai sore:** pagi + istirahat + siang dipisah otomatis.
- File: `WorkshopSchedule.php` (`endedDuringLunchWithoutResume`), `mechanic-day-session.ts` (`afterActivitySaved`, `resolveActivityStartTime`), `activity-hours.ts`.
- **Fix 2026-06-12:** Berhenti tepat jam **12:00** harus dianggap mulai istirahat (`end >= 12:00`, bukan `> 12:00`). Tanpa ini tombol **Mulai Kerja Siang** tidak muncul setelah simpan pagi. Rehydrate state dari aktivitas server via `syncAfternoonResumeFromActivities` + `inferNeedsAfternoonStart`.

## 2026-06-13 — Status operasional WO (Status WO.docx)

- Kolom **Status Operasional** di `/work-orders` — supervisor (`WORK_ORDERS_APPROVE`) klik badge untuk pilih status + keterangan.
- 15 status: OPEN, WAIT MAN POWER, READY TO START, IN PROGRESS, WAIT DECISION, WAITING PART/TOOL/ALAT ANGKAT/INSPECTION/MACHINING/FABRICATION, HOLD, CANCEL, COMPLETED, CLOSED (`verified_closed` di DB).
- Field: `operational_status`, `operational_status_notes`; API `PATCH /work-orders/{id}/operational-fields`.
- File: `WorkOrderOperationalStatus.php`, `wo-operational-status.ts`, `WorkOrderOperationalStatusEditor.tsx`.
- **COMPLETED / CLOSED** hanya jika progress WO 100% (Main: semua Sub WO Finish+ **dan** punya aktivitas working; Sub: idem). Validasi frontend + backend (`WorkOrderProgress.php`).
- Hapus aktivitas mekanik → Sub WO `in_execution` tanpa aktivitas working otomatis kembali ke `approved` (`reconcileExecutionStatusFromActivities`).
- **Multi-mekanik per Sub WO:** Selesai hanya jika jumlah mekanik unik dengan aktivitas approved ≥ `manpower_count` dan tidak ada aktivitas draft/pending. Badge: `Progress (1/2 mekanik)` vs `Selesai (2/2 mekanik)`. Finish diblok jika crew belum lengkap (`WorkOrderMechanicProgress.php`).

## 2026-06-17 — Notifikasi draft aktivitas mekanik

- Badge di navbar **Mechanic Activity** untuk mekanik: jumlah aktivitas **draft** belum diajukan (`GET /mechanic-activities/draft-count`).
- Banner peringatan di `/activities` + refresh otomatis via event `activities-draft-count-changed`.
- Supervisor tetap melihat badge **pending approval** (prioritas jika keduanya ada).

## 2026-06-17 — Jam mulai otomatis setelah istirahat (real-time)

- Tombol manual **Mulai Kerja Siang** dihapus — setelah istirahat selesai (13:00 / Jumat 13:30), jam mulai siang **otomatis** tercatat dari waktu sebenarnya (`ensureAfternoonSessionAutoStarted`).
- Polling sesi setiap 1 detik agar resume tepat setelah istirahat.
- Jam mulai pagi tetap dari login; jam berjalan ditampilkan real-time di form.
- File: `mechanic-day-session.ts`, `AfternoonStartPanel.tsx`, `MechanicAutoTimeFields.tsx`, `activities/page.tsx`.

## 2026-06-17 — Jam selesai manual (tombol Stop)

- `/activities`: jam selesai **tidak lagi otomatis** mengikuti jam sekarang; mekanik wajib tekan tombol merah **Stop** sebelum **Simpan Aktivitas**.
- Jam istirahat tetap dipisah otomatis di backend saat simpan (rentang 12:00–13:00 / Jumat lebih panjang).
- Panel lembur (`OvertimeRequestPanel`) hanya muncul **setelah Stop** jika jam selesai melewati 18:00; simpan tetap diblok sampai supervisor menyetujui.
- **Jam Mulai** tetap dari login pertama / lanjutan sesi / anchor otomatis sesi siang setelah istirahat (tetap, tidak mengikuti jam berjalan).
- **Jam berjalan** menampilkan waktu real-time terpisah di samping tombol Stop.
- File: `MechanicAutoTimeFields.tsx`, `activities/page.tsx` (`endTimeStopped`, `handleStopWork`, `resetWorkStopState`).

## 2026-06-17 — Fix lembur palsu saat login/simpan aktivitas

- Jam mulai = jam selesai (baru login/simpan) tidak lagi dianggap shift 24 jam → `overlapsOvertime` pakai `end < start` untuk overnight, bukan `<=`.
- Tombol Simpan tidak diblok lembur saat `overtimeStatus` masih loading; cek lembur hanya jika `start_time` sudah ada.

## 2026-06-11 — Reports pagination per kategori

- Setiap blok tabel di `/reports` punya pagination sendiri (10/20/50/100 per halaman) agar halaman tidak penuh.
- **Server-side:** WO History, Mechanic Activity History, Unit/Component History, Cost Report (`per_page` ke API).
- **Client-side:** Lead Time, Delay WO detail, Utilization, Mechanic Performance, Spare Parts (`useClientPagination`).
- Productivity Report (~3 baris kategori) tidak dipaginate.
- File: `ReportPagination.tsx`, `use-client-pagination.ts`, `HistoryTab.tsx`, `AnalyticsTab.tsx`, `DelayUtilizationSections.tsx`, `UnitComponentHistorySection.tsx`, `CostReportTab.tsx`.

## 2026-06-03 — Deploy server LAN (192.168.32.15)

- Folder di `C:\xampp\htdocs\work-orders`. Port **3000** e-letter, **3001** terpakai → frontend WO APS default **3002** (`scripts/deploy.config.ps1`), API **8000**. Cek port: `find-free-port.ps1`.
- Client wajib pakai IP server di `NEXT_PUBLIC_API_URL` (bukan localhost). CORS: env `CORS_ALLOWED_ORIGINS` di `backend/.env`.
- Script: `scripts/setup-wo-aps-server.ps1` (sekali), `scripts/start-wo-aps-server.ps1` (setiap jalan). Dokumen: `docs/deployment-server.md`.
- **npm install macet di server:** gunakan Next.js `output: standalone` — build di PC dev, `package-frontend-for-server.ps1`, copy `deploy/wo-aps-frontend` ke server, start dengan `node server.js` (`start-frontend-standalone.ps1`). Server hanya perlu Node.js + PHP, tidak perlu npm install.
