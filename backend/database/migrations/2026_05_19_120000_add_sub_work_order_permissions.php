<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @return array<string, array{label: string, group: string}> */
    private function subPermissionDefinitions(): array
    {
        return [
            'work_orders.sub.create' => [
                'label' => 'Buat Sub WO',
                'group' => 'work_orders',
            ],
            'work_orders.sub.edit' => [
                'label' => 'Ubah Sub WO',
                'group' => 'work_orders',
            ],
            'work_orders.sub.delete' => [
                'label' => 'Hapus Sub WO',
                'group' => 'work_orders',
            ],
        ];
    }

    public function up(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        $definitions = $this->subPermissionDefinitions();
        $subPermissions = array_keys($definitions);

        foreach ($definitions as $name => $meta) {
            Permission::updateOrCreate(
                ['name' => $name],
                [
                    'label' => $meta['label'],
                    'group' => $meta['group'],
                ]
            );
        }

        $roleMap = [
            'admin' => $subPermissions,
            'planner' => $subPermissions,
            'supervisor' => [
                'work_orders.sub.edit',
                'work_orders.sub.delete',
            ],
        ];

        foreach ($roleMap as $slug => $names) {
            $role = Role::where('slug', $slug)->first();
            if (! $role) {
                continue;
            }

            $ids = Permission::whereIn('name', $names)->pluck('id');
            $role->permissions()->syncWithoutDetaching($ids);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        Permission::whereIn('name', array_keys($this->subPermissionDefinitions()))->delete();
    }
};
