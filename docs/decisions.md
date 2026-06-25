# Architecture Decisions

## ADR-001: Role-Based Permission Matrix (2026-05-19)

### Context

Workshop WO system membutuhkan pembatasan akses per role (planner, supervisor, mechanic, logistic) sesuai alur PPT.

### Decision

Implementasi permission string terpusat di `App\Support\Permission` (backend) dan `src/lib/permissions.ts` (frontend), dengan:

- Middleware Laravel `permission` pada setiap route API
- Validasi ownership tambahan di controller (WO milik planner, aktivitas milik mekanik, dll.)
- Frontend: `AuthProvider` + `can()` + route guard + menu filter

### Role Matrix (ringkas)

| Role | WO Create | WO Approve | Activity Input | Parts Create | Parts Logistic | Reports |
|------|-----------|------------|----------------|--------------|----------------|---------|
| planner | ✓ | | | ✓ | | ✓ |
| supervisor | | ✓ | | | | ✓ |
| mechanic | | | ✓ | ✓ | | |
| logistic | | | | | ✓ | |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Review

2026-08-19 — evaluasi kebutuhan permission per workshop/site.
