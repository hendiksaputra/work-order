# Todo — Work Order APS

## Recently Completed (2026-05-19)

- [x] Initial Laravel API + MySQL schema (`wo_aps`)
- [x] Next.js frontend — Dashboard, WO, Activity, Parts, Inspection, Reports
- [x] Seed data: users demo, activity types dari PPT, sample WO
- [x] Sanctum authentication

## Recently Completed (2026-05-19)

- [x] Role permission ketat — backend middleware + frontend route/menu guard

## Recently Completed (2026-05-22)

- [x] `/reports` Fase 1 — tab History (WO history, mechanic activity history) + Report KPI (lead time actual vs target, dll.)

## Recently Completed (2026-05-19)

- [x] `/reports` Fase 3 — Cost Report tab: API `GET /reports/cost`, material (parts) + labor (jam × tarif), filter WO

## Recently Completed (2026-05-19)

- [x] `/reports` Fase 4 — Unit/Component History (tab History), Delay Analysis + Utilization (tab Report KPI)
- [x] Migration `delay_cause`, `delay_notes`, `component_installed_at` pada `work_orders`
- [x] API: `GET /reports/unit-component-history`, `/delay-analysis`, `/utilization`
- [x] WO: `PATCH /work-orders/{id}/operational-fields` + panel di detail WO
- [x] Pengaturan Workshop: jam kerja standar/hari untuk utilisasi

## Recently Completed (2026-06-03)

- [x] UAT Fase 4 langkah 2 — script `scripts/uat-phase4-step2.ps1` + verifikasi browser (WO-ADIKARA-001 → Delay & Unit/Component)

## Recently Completed (2026-05-19)

- [x] Permission Sub WO — `work_orders.sub.create`, `work_orders.sub.edit`, `work_orders.sub.delete` (backend + frontend + roles UI + migration)
- [x] `/activities` — filter Main/Sub WO di Daftar Aktivitas menampilkan aktivitas semua mekanik pada Sub WO terpilih
- [x] Sidebar menu Work Order — badge notifikasi jumlah WO belum disetujui (`pending_supervisor` + draft supervisor); refresh otomatis saat buat/approve/submit WO

## Recently Completed (2026-06-11)

- [x] `/activities` — lembur setelah 18:00: wajib ajukan ke supervisor, approve di Inspection, segmen lembur terpisah
- [x] `/activities` — wajib **Mulai Kerja Siang** setelah istirahat: jam mulai aktual tercatat + indikator keterlambatan (Jumat istirahat 13:30)
- [x] `/reports` — pagination per kategori/blok (default 10 baris): History (WO, aktivitas, unit/komponen), KPI (lead time, delay detail, utilisasi, kinerja mekanik, spare part), Cost Report
- [x] Komponen bersama: `ReportPagination`, hook `useClientPagination` untuk data client-side

## Recently Completed (2026-06-10)

- [x] Bug fix `/settings/users` — tabel tidak refresh setelah edit/create/delete (race condition `load()`, optimistic merge + request sequence guard)
- [x] Create WO — field Ex Unit/Unit bisa diketik manual (tanpa wajib pilih dari master OITM); Unit Model juga bisa diketik manual
- [x] Create/Edit WO — Jumlah Man Power & Estimasi Jam Kerja read-only untuk Planner; hanya Supervisor (permission approve) yang boleh isi
- [x] Fix Ex Unit lookup untuk Supervisor — `/oitm/lookup` boleh diakses dengan `work_orders.create|update` atau `oitm.view`

## In Progress

- [ ] Browser UAT lengkap semua role
- [ ] Print form parts (wet approval option)

## Backlog

- SAP integration untuk parts consumption
- Export PDF laporan KPI
- Unit/Component history drill-down
- Delay analysis report detail
