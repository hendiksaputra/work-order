<?php

namespace App\Support;

final class Permission
{
    public const DASHBOARD_VIEW = 'dashboard.view';

    public const WORK_ORDERS_VIEW = 'work_orders.view';

    public const WORK_ORDERS_CREATE = 'work_orders.create';

    public const WORK_ORDERS_UPDATE = 'work_orders.update';

    public const WORK_ORDERS_SUBMIT = 'work_orders.submit';

    public const WORK_ORDERS_APPROVE = 'work_orders.approve';

    public const WORK_ORDERS_EDIT_ANY_STATUS = 'work_orders.edit_any_status';

    public const WORK_ORDERS_DELETE_ANY_STATUS = 'work_orders.delete_any_status';

    public const WORK_ORDERS_SUB_CREATE = 'work_orders.sub.create';

    public const WORK_ORDERS_SUB_EDIT = 'work_orders.sub.edit';

    public const WORK_ORDERS_SUB_DELETE = 'work_orders.sub.delete';

    public const MECHANIC_ACTIVITIES_VIEW_ALL = 'mechanic_activities.view_all';

    public const MECHANIC_ACTIVITIES_VIEW_OWN = 'mechanic_activities.view_own';

    public const MECHANIC_ACTIVITIES_CREATE = 'mechanic_activities.create';

    public const MECHANIC_ACTIVITIES_SUBMIT = 'mechanic_activities.submit';

    public const MECHANIC_ACTIVITIES_APPROVE = 'mechanic_activities.approve';

    public const MECHANIC_ACTIVITIES_UPDATE = 'mechanic_activities.update';

    public const MECHANIC_ACTIVITIES_DELETE = 'mechanic_activities.delete';

    public const MECHANIC_ACTIVITIES_EDIT_ANY_STATUS = 'mechanic_activities.edit_any_status';

    public const MECHANIC_ACTIVITIES_DELETE_ANY_STATUS = 'mechanic_activities.delete_any_status';

    public const PARTS_VIEW = 'parts_requests.view';

    public const PARTS_CREATE = 'parts_requests.create';

    public const PARTS_SUBMIT = 'parts_requests.submit';

    public const PARTS_SUPERVISOR = 'parts_requests.supervisor';

    public const PARTS_LOGISTIC = 'parts_requests.logistic';

    public const PARTS_UPDATE = 'parts_requests.update';

    public const PARTS_DELETE = 'parts_requests.delete';

    public const PARTS_EDIT_ANY_STATUS = 'parts_requests.edit_any_status';

    public const PARTS_DELETE_ANY_STATUS = 'parts_requests.delete_any_status';

    public const INSPECTION_ACCESS = 'inspection.access';

    public const REPORTS_VIEW = 'reports.view';

    public const ACTIVITY_TYPES_VIEW = 'activity_types.view';

    public const USERS_VIEW = 'users.view';

    public const USERS_MANAGE = 'users.manage';

    public const USERS_IMPORT = 'users.import';

    public const ROLES_VIEW = 'roles.view';

    public const ROLES_MANAGE = 'roles.manage';

    public const OITM_VIEW = 'oitm.view';

    public const OITM_MANAGE = 'oitm.manage';

    public const SETTINGS_MANAGE = 'settings.manage';

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            self::DASHBOARD_VIEW => 'Lihat Dashboard',
            self::WORK_ORDERS_VIEW => 'Lihat Work Order',
            self::WORK_ORDERS_CREATE => 'Buat Work Order',
            self::WORK_ORDERS_UPDATE => 'Ubah Work Order',
            self::WORK_ORDERS_SUBMIT => 'Submit Work Order',
            self::WORK_ORDERS_APPROVE => 'Approve Work Order',
            self::WORK_ORDERS_EDIT_ANY_STATUS => 'Ubah WO (Semua Status)',
            self::WORK_ORDERS_DELETE_ANY_STATUS => 'Hapus WO (Semua Status)',
            self::WORK_ORDERS_SUB_CREATE => 'Buat Sub WO',
            self::WORK_ORDERS_SUB_EDIT => 'Ubah Sub WO',
            self::WORK_ORDERS_SUB_DELETE => 'Hapus Sub WO',
            self::MECHANIC_ACTIVITIES_VIEW_ALL => 'Lihat Semua Aktivitas Mekanik',
            self::MECHANIC_ACTIVITIES_VIEW_OWN => 'Lihat Aktivitas Sendiri',
            self::MECHANIC_ACTIVITIES_CREATE => 'Buat Aktivitas Mekanik',
            self::MECHANIC_ACTIVITIES_SUBMIT => 'Submit Aktivitas Mekanik',
            self::MECHANIC_ACTIVITIES_APPROVE => 'Approve Aktivitas Mekanik',
            self::MECHANIC_ACTIVITIES_UPDATE => 'Ubah Aktivitas (Draft Milik Sendiri)',
            self::MECHANIC_ACTIVITIES_DELETE => 'Hapus Aktivitas (Draft Milik Sendiri)',
            self::MECHANIC_ACTIVITIES_EDIT_ANY_STATUS => 'Ubah Aktivitas (Semua Status)',
            self::MECHANIC_ACTIVITIES_DELETE_ANY_STATUS => 'Hapus Aktivitas (Semua Status)',
            self::PARTS_VIEW => 'Lihat Parts Request',
            self::PARTS_CREATE => 'Buat Parts Request',
            self::PARTS_SUBMIT => 'Submit Parts Request',
            self::PARTS_SUPERVISOR => 'Supervisor Parts',
            self::PARTS_LOGISTIC => 'Logistic Parts',
            self::PARTS_UPDATE => 'Ubah Parts Request (Draft Milik Sendiri)',
            self::PARTS_DELETE => 'Hapus Parts Request (Draft Milik Sendiri)',
            self::PARTS_EDIT_ANY_STATUS => 'Ubah Parts Request (Semua Status)',
            self::PARTS_DELETE_ANY_STATUS => 'Hapus Parts Request (Semua Status)',
            self::INSPECTION_ACCESS => 'Akses Inspection',
            self::REPORTS_VIEW => 'Lihat Laporan',
            self::ACTIVITY_TYPES_VIEW => 'Lihat Tipe Aktivitas',
            self::USERS_VIEW => 'Lihat Pengguna',
            self::USERS_MANAGE => 'Kelola Pengguna',
            self::USERS_IMPORT => 'Import Pengguna (Excel)',
            self::ROLES_VIEW => 'Lihat Role & Permission',
            self::ROLES_MANAGE => 'Kelola Role & Permission',
            self::OITM_VIEW => 'Lihat Master Unit (OITM)',
            self::OITM_MANAGE => 'Kelola Master Unit (OITM)',
            self::SETTINGS_MANAGE => 'Kelola Pengaturan Workshop',
        ];
    }

    /** @return array<string, string> */
    public static function groups(): array
    {
        return [
            self::DASHBOARD_VIEW => 'dashboard',
            self::WORK_ORDERS_VIEW => 'work_orders',
            self::WORK_ORDERS_CREATE => 'work_orders',
            self::WORK_ORDERS_UPDATE => 'work_orders',
            self::WORK_ORDERS_SUBMIT => 'work_orders',
            self::WORK_ORDERS_APPROVE => 'work_orders',
            self::WORK_ORDERS_EDIT_ANY_STATUS => 'work_orders',
            self::WORK_ORDERS_DELETE_ANY_STATUS => 'work_orders',
            self::WORK_ORDERS_SUB_CREATE => 'work_orders',
            self::WORK_ORDERS_SUB_EDIT => 'work_orders',
            self::WORK_ORDERS_SUB_DELETE => 'work_orders',
            self::MECHANIC_ACTIVITIES_VIEW_ALL => 'activities',
            self::MECHANIC_ACTIVITIES_VIEW_OWN => 'activities',
            self::MECHANIC_ACTIVITIES_CREATE => 'activities',
            self::MECHANIC_ACTIVITIES_SUBMIT => 'activities',
            self::MECHANIC_ACTIVITIES_APPROVE => 'activities',
            self::MECHANIC_ACTIVITIES_UPDATE => 'activities',
            self::MECHANIC_ACTIVITIES_DELETE => 'activities',
            self::MECHANIC_ACTIVITIES_EDIT_ANY_STATUS => 'activities',
            self::MECHANIC_ACTIVITIES_DELETE_ANY_STATUS => 'activities',
            self::PARTS_VIEW => 'parts',
            self::PARTS_CREATE => 'parts',
            self::PARTS_SUBMIT => 'parts',
            self::PARTS_SUPERVISOR => 'parts',
            self::PARTS_LOGISTIC => 'parts',
            self::PARTS_UPDATE => 'parts',
            self::PARTS_DELETE => 'parts',
            self::PARTS_EDIT_ANY_STATUS => 'parts',
            self::PARTS_DELETE_ANY_STATUS => 'parts',
            self::INSPECTION_ACCESS => 'inspection',
            self::REPORTS_VIEW => 'reports',
            self::ACTIVITY_TYPES_VIEW => 'master',
            self::USERS_VIEW => 'administration',
            self::USERS_MANAGE => 'administration',
            self::USERS_IMPORT => 'administration',
            self::ROLES_VIEW => 'administration',
            self::ROLES_MANAGE => 'administration',
            self::OITM_VIEW => 'master',
            self::OITM_MANAGE => 'master',
            self::SETTINGS_MANAGE => 'administration',
        ];
    }

    /** @return array<string, list<string>> */
    public static function matrix(): array
    {
        return [
            'admin' => self::all(),
            'planner' => [
                self::DASHBOARD_VIEW,
                self::WORK_ORDERS_VIEW,
                self::WORK_ORDERS_CREATE,
                self::WORK_ORDERS_UPDATE,
                self::WORK_ORDERS_SUB_CREATE,
                self::WORK_ORDERS_SUB_EDIT,
                self::WORK_ORDERS_SUB_DELETE,
                self::WORK_ORDERS_SUBMIT,
                self::MECHANIC_ACTIVITIES_VIEW_ALL,
                self::PARTS_VIEW,
                self::PARTS_CREATE,
                self::PARTS_SUBMIT,
                self::REPORTS_VIEW,
                self::ACTIVITY_TYPES_VIEW,
                self::OITM_VIEW,
                self::OITM_MANAGE,
            ],
            'supervisor' => [
                self::DASHBOARD_VIEW,
                self::WORK_ORDERS_VIEW,
                self::WORK_ORDERS_APPROVE,
                self::WORK_ORDERS_SUB_EDIT,
                self::WORK_ORDERS_SUB_DELETE,
                self::MECHANIC_ACTIVITIES_VIEW_ALL,
                self::MECHANIC_ACTIVITIES_APPROVE,
                self::PARTS_VIEW,
                self::PARTS_SUPERVISOR,
                self::INSPECTION_ACCESS,
                self::REPORTS_VIEW,
                self::ACTIVITY_TYPES_VIEW,
                self::OITM_VIEW,
            ],
            'mechanic' => [
                self::DASHBOARD_VIEW,
                self::WORK_ORDERS_VIEW,
                self::MECHANIC_ACTIVITIES_VIEW_OWN,
                self::MECHANIC_ACTIVITIES_CREATE,
                self::MECHANIC_ACTIVITIES_SUBMIT,
                self::MECHANIC_ACTIVITIES_UPDATE,
                self::MECHANIC_ACTIVITIES_DELETE,
                self::PARTS_VIEW,
                self::PARTS_CREATE,
                self::PARTS_SUBMIT,
                self::PARTS_UPDATE,
                self::PARTS_DELETE,
                self::ACTIVITY_TYPES_VIEW,
            ],
            'logistic' => [
                self::DASHBOARD_VIEW,
                self::WORK_ORDERS_VIEW,
                self::PARTS_VIEW,
                self::PARTS_LOGISTIC,
                self::ACTIVITY_TYPES_VIEW,
            ],
        ];
    }

    /** @return list<string> */
    public static function all(): array
    {
        return [
            self::DASHBOARD_VIEW,
            self::WORK_ORDERS_VIEW,
            self::WORK_ORDERS_CREATE,
            self::WORK_ORDERS_UPDATE,
            self::WORK_ORDERS_SUBMIT,
            self::WORK_ORDERS_APPROVE,
            self::WORK_ORDERS_EDIT_ANY_STATUS,
            self::WORK_ORDERS_DELETE_ANY_STATUS,
            self::WORK_ORDERS_SUB_CREATE,
            self::WORK_ORDERS_SUB_EDIT,
            self::WORK_ORDERS_SUB_DELETE,
            self::MECHANIC_ACTIVITIES_VIEW_ALL,
            self::MECHANIC_ACTIVITIES_VIEW_OWN,
            self::MECHANIC_ACTIVITIES_CREATE,
            self::MECHANIC_ACTIVITIES_SUBMIT,
            self::MECHANIC_ACTIVITIES_APPROVE,
            self::MECHANIC_ACTIVITIES_UPDATE,
            self::MECHANIC_ACTIVITIES_DELETE,
            self::MECHANIC_ACTIVITIES_EDIT_ANY_STATUS,
            self::MECHANIC_ACTIVITIES_DELETE_ANY_STATUS,
            self::PARTS_VIEW,
            self::PARTS_CREATE,
            self::PARTS_SUBMIT,
            self::PARTS_SUPERVISOR,
            self::PARTS_LOGISTIC,
            self::PARTS_UPDATE,
            self::PARTS_DELETE,
            self::PARTS_EDIT_ANY_STATUS,
            self::PARTS_DELETE_ANY_STATUS,
            self::INSPECTION_ACCESS,
            self::REPORTS_VIEW,
            self::ACTIVITY_TYPES_VIEW,
            self::USERS_VIEW,
            self::USERS_MANAGE,
            self::USERS_IMPORT,
            self::ROLES_VIEW,
            self::ROLES_MANAGE,
            self::OITM_VIEW,
            self::OITM_MANAGE,
            self::SETTINGS_MANAGE,
        ];
    }

    /** @return list<string> */
    public static function forRole(string $role): array
    {
        if (\Illuminate\Support\Facades\Schema::hasTable('roles')) {
            $roleModel = \App\Models\Role::where('slug', $role)->with('permissions')->first();
            if ($roleModel) {
                return $roleModel->permissionNames();
            }
        }

        return self::matrix()[$role] ?? [];
    }
}
