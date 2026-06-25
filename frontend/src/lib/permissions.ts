import type { User, UserRole } from './types';

/** Must stay in sync with backend App\Support\Permission */
export const Permission = {
  DASHBOARD_VIEW: 'dashboard.view',
  WORK_ORDERS_VIEW: 'work_orders.view',
  WORK_ORDERS_CREATE: 'work_orders.create',
  WORK_ORDERS_UPDATE: 'work_orders.update',
  WORK_ORDERS_SUBMIT: 'work_orders.submit',
  WORK_ORDERS_APPROVE: 'work_orders.approve',
  WORK_ORDERS_EDIT_ANY_STATUS: 'work_orders.edit_any_status',
  WORK_ORDERS_DELETE_ANY_STATUS: 'work_orders.delete_any_status',
  WORK_ORDERS_SUB_CREATE: 'work_orders.sub.create',
  WORK_ORDERS_SUB_EDIT: 'work_orders.sub.edit',
  WORK_ORDERS_SUB_DELETE: 'work_orders.sub.delete',
  MECHANIC_ACTIVITIES_VIEW_ALL: 'mechanic_activities.view_all',
  MECHANIC_ACTIVITIES_VIEW_OWN: 'mechanic_activities.view_own',
  MECHANIC_ACTIVITIES_CREATE: 'mechanic_activities.create',
  MECHANIC_ACTIVITIES_SUBMIT: 'mechanic_activities.submit',
  MECHANIC_ACTIVITIES_APPROVE: 'mechanic_activities.approve',
  MECHANIC_ACTIVITIES_UPDATE: 'mechanic_activities.update',
  MECHANIC_ACTIVITIES_DELETE: 'mechanic_activities.delete',
  MECHANIC_ACTIVITIES_EDIT_ANY_STATUS: 'mechanic_activities.edit_any_status',
  MECHANIC_ACTIVITIES_DELETE_ANY_STATUS: 'mechanic_activities.delete_any_status',
  PARTS_VIEW: 'parts_requests.view',
  PARTS_CREATE: 'parts_requests.create',
  PARTS_SUBMIT: 'parts_requests.submit',
  PARTS_SUPERVISOR: 'parts_requests.supervisor',
  PARTS_LOGISTIC: 'parts_requests.logistic',
  PARTS_UPDATE: 'parts_requests.update',
  PARTS_DELETE: 'parts_requests.delete',
  PARTS_EDIT_ANY_STATUS: 'parts_requests.edit_any_status',
  PARTS_DELETE_ANY_STATUS: 'parts_requests.delete_any_status',
  INSPECTION_ACCESS: 'inspection.access',
  REPORTS_VIEW: 'reports.view',
  ACTIVITY_TYPES_VIEW: 'activity_types.view',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  USERS_IMPORT: 'users.import',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  OITM_VIEW: 'oitm.view',
  OITM_MANAGE: 'oitm.manage',
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export const PERMISSION_LABELS: Record<PermissionName, string> = {
  [Permission.DASHBOARD_VIEW]: 'Lihat Dashboard',
  [Permission.WORK_ORDERS_VIEW]: 'Lihat Work Order',
  [Permission.WORK_ORDERS_CREATE]: 'Buat Work Order',
  [Permission.WORK_ORDERS_UPDATE]: 'Ubah Work Order',
  [Permission.WORK_ORDERS_SUBMIT]: 'Submit Work Order',
  [Permission.WORK_ORDERS_APPROVE]: 'Approve Work Order',
  [Permission.WORK_ORDERS_EDIT_ANY_STATUS]: 'Ubah WO (Semua Status)',
  [Permission.WORK_ORDERS_DELETE_ANY_STATUS]: 'Hapus WO (Semua Status)',
  [Permission.WORK_ORDERS_SUB_CREATE]: 'Buat Sub WO',
  [Permission.WORK_ORDERS_SUB_EDIT]: 'Ubah Sub WO',
  [Permission.WORK_ORDERS_SUB_DELETE]: 'Hapus Sub WO',
  [Permission.MECHANIC_ACTIVITIES_VIEW_ALL]: 'Lihat Semua Aktivitas Mekanik',
  [Permission.MECHANIC_ACTIVITIES_VIEW_OWN]: 'Lihat Aktivitas Sendiri',
  [Permission.MECHANIC_ACTIVITIES_CREATE]: 'Buat Aktivitas Mekanik',
  [Permission.MECHANIC_ACTIVITIES_SUBMIT]: 'Submit Aktivitas Mekanik',
  [Permission.MECHANIC_ACTIVITIES_APPROVE]: 'Approve Aktivitas Mekanik',
  [Permission.MECHANIC_ACTIVITIES_UPDATE]: 'Ubah Aktivitas (Draft Milik Sendiri)',
  [Permission.MECHANIC_ACTIVITIES_DELETE]: 'Hapus Aktivitas (Draft Milik Sendiri)',
  [Permission.MECHANIC_ACTIVITIES_EDIT_ANY_STATUS]: 'Ubah Aktivitas (Semua Status)',
  [Permission.MECHANIC_ACTIVITIES_DELETE_ANY_STATUS]: 'Hapus Aktivitas (Semua Status)',
  [Permission.PARTS_VIEW]: 'Lihat Parts Request',
  [Permission.PARTS_CREATE]: 'Buat Parts Request',
  [Permission.PARTS_SUBMIT]: 'Submit Parts Request',
  [Permission.PARTS_SUPERVISOR]: 'Supervisor Parts',
  [Permission.PARTS_LOGISTIC]: 'Logistic Parts',
  [Permission.PARTS_UPDATE]: 'Ubah Parts Request (Draft Milik Sendiri)',
  [Permission.PARTS_DELETE]: 'Hapus Parts Request (Draft Milik Sendiri)',
  [Permission.PARTS_EDIT_ANY_STATUS]: 'Ubah Parts Request (Semua Status)',
  [Permission.PARTS_DELETE_ANY_STATUS]: 'Hapus Parts Request (Semua Status)',
  [Permission.INSPECTION_ACCESS]: 'Akses Inspection',
  [Permission.REPORTS_VIEW]: 'Lihat Laporan',
  [Permission.ACTIVITY_TYPES_VIEW]: 'Lihat Tipe Aktivitas',
  [Permission.USERS_VIEW]: 'Lihat Pengguna',
  [Permission.USERS_MANAGE]: 'Kelola Pengguna',
  [Permission.USERS_IMPORT]: 'Import Pengguna (Excel)',
  [Permission.ROLES_VIEW]: 'Lihat Role & Permission',
  [Permission.ROLES_MANAGE]: 'Kelola Role & Permission',
  [Permission.OITM_VIEW]: 'Lihat Master Unit (OITM)',
  [Permission.OITM_MANAGE]: 'Kelola Master Unit (OITM)',
  [Permission.SETTINGS_MANAGE]: 'Kelola Pengaturan Workshop',
};

export const PERMISSION_GROUPS: Record<string, string> = {
  dashboard: 'Dashboard',
  work_orders: 'Work Order',
  activities: 'Aktivitas Mekanik',
  parts: 'Parts & Consumable',
  inspection: 'Inspection',
  reports: 'Laporan',
  master: 'Master Data',
  administration: 'Administrasi',
};

export type PermissionName = (typeof Permission)[keyof typeof Permission];

const ROLE_PERMISSIONS: Record<UserRole, PermissionName[]> = {
  admin: Object.values(Permission) as PermissionName[],
  planner: [
    Permission.DASHBOARD_VIEW,
    Permission.WORK_ORDERS_VIEW,
    Permission.WORK_ORDERS_CREATE,
    Permission.WORK_ORDERS_UPDATE,
    Permission.WORK_ORDERS_SUB_CREATE,
    Permission.WORK_ORDERS_SUB_EDIT,
    Permission.WORK_ORDERS_SUB_DELETE,
    Permission.WORK_ORDERS_SUBMIT,
    Permission.MECHANIC_ACTIVITIES_VIEW_ALL,
    Permission.PARTS_VIEW,
    Permission.PARTS_CREATE,
    Permission.PARTS_SUBMIT,
    Permission.REPORTS_VIEW,
    Permission.ACTIVITY_TYPES_VIEW,
    Permission.OITM_VIEW,
    Permission.OITM_MANAGE,
  ],
  supervisor: [
    Permission.DASHBOARD_VIEW,
    Permission.WORK_ORDERS_VIEW,
    Permission.WORK_ORDERS_APPROVE,
    Permission.WORK_ORDERS_SUB_EDIT,
    Permission.WORK_ORDERS_SUB_DELETE,
    Permission.MECHANIC_ACTIVITIES_VIEW_ALL,
    Permission.MECHANIC_ACTIVITIES_APPROVE,
    Permission.PARTS_VIEW,
    Permission.PARTS_SUPERVISOR,
    Permission.INSPECTION_ACCESS,
    Permission.REPORTS_VIEW,
    Permission.ACTIVITY_TYPES_VIEW,
    Permission.OITM_VIEW,
  ],
  mechanic: [
    Permission.DASHBOARD_VIEW,
    Permission.WORK_ORDERS_VIEW,
    Permission.MECHANIC_ACTIVITIES_VIEW_OWN,
    Permission.MECHANIC_ACTIVITIES_CREATE,
    Permission.MECHANIC_ACTIVITIES_SUBMIT,
    Permission.MECHANIC_ACTIVITIES_UPDATE,
    Permission.MECHANIC_ACTIVITIES_DELETE,
    Permission.PARTS_VIEW,
    Permission.PARTS_CREATE,
    Permission.PARTS_SUBMIT,
    Permission.PARTS_UPDATE,
    Permission.PARTS_DELETE,
    Permission.ACTIVITY_TYPES_VIEW,
  ],
  logistic: [
    Permission.DASHBOARD_VIEW,
    Permission.WORK_ORDERS_VIEW,
    Permission.PARTS_VIEW,
    Permission.PARTS_LOGISTIC,
    Permission.ACTIVITY_TYPES_VIEW,
  ],
};

export const ROUTE_PERMISSIONS: Record<string, PermissionName> = {
  '/dashboard': Permission.DASHBOARD_VIEW,
  '/work-orders': Permission.WORK_ORDERS_VIEW,
  '/work-orders/new': Permission.WORK_ORDERS_CREATE,
  '/activities': Permission.MECHANIC_ACTIVITIES_VIEW_OWN,
  '/parts': Permission.PARTS_VIEW,
  '/inspection': Permission.INSPECTION_ACCESS,
  '/reports': Permission.REPORTS_VIEW,
  '/units': Permission.OITM_VIEW,
  '/settings/users': Permission.USERS_VIEW,
  '/settings/roles': Permission.ROLES_VIEW,
  '/settings/workshop': Permission.SETTINGS_MANAGE,
};

export function permissionsForRole(role: UserRole): PermissionName[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(user: User | null, permission: PermissionName): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.permissions) {
    return user.permissions.includes(permission);
  }
  return permissionsForRole(user.role).includes(permission);
}

export function canAccessRoute(user: User | null, pathname: string): boolean {
  if (!user) return false;
  if (pathname === '/unauthorized') return true;

  const sorted = Object.entries(ROUTE_PERMISSIONS).sort((a, b) => b[0].length - a[0].length);

  for (const [route, permission] of sorted) {
    const matches =
      pathname === route ||
      (route === '/work-orders' && (pathname === '/work-orders' || /^\/work-orders\/\d+$/.test(pathname))) ||
      (route !== '/work-orders' && pathname.startsWith(`${route}/`));

    if (!matches) continue;

    if (permission === Permission.MECHANIC_ACTIVITIES_VIEW_OWN) {
      return (
        can(user, Permission.MECHANIC_ACTIVITIES_VIEW_OWN) ||
        can(user, Permission.MECHANIC_ACTIVITIES_VIEW_ALL)
      );
    }

    return can(user, permission);
  }

  return true;
}

export function getDefaultRoute(user: User | null): string {
  if (!user) return '/login';
  if (can(user, Permission.DASHBOARD_VIEW)) return '/dashboard';
  if (can(user, Permission.INSPECTION_ACCESS)) return '/inspection';
  if (can(user, Permission.MECHANIC_ACTIVITIES_VIEW_OWN)) return '/activities';
  if (can(user, Permission.PARTS_VIEW)) return '/parts';
  return '/unauthorized';
}
