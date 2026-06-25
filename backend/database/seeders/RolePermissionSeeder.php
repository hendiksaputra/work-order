<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Support\Permission as PermissionDef;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $labels = PermissionDef::labels();
        $groups = PermissionDef::groups();

        foreach (PermissionDef::all() as $name) {
            Permission::updateOrCreate(
                ['name' => $name],
                [
                    'label' => $labels[$name] ?? $name,
                    'group' => $groups[$name] ?? 'general',
                ]
            );
        }

        $roleMeta = [
            'admin' => ['name' => 'Administrator', 'description' => 'Akses penuh sistem termasuk pengaturan user & role', 'is_system' => true],
            'planner' => ['name' => 'Service Analyst / Planner', 'description' => 'Membuat dan mengelola Work Order', 'is_system' => true],
            'supervisor' => ['name' => 'Supervisor Workshop', 'description' => 'Approval WO, aktivitas, dan parts', 'is_system' => true],
            'mechanic' => ['name' => 'Mekanik', 'description' => 'Input aktivitas dan permintaan parts', 'is_system' => true],
            'logistic' => ['name' => 'Logistic', 'description' => 'Proses pengambilan parts dari gudang', 'is_system' => true],
        ];

        foreach (PermissionDef::matrix() as $slug => $permissions) {
            $meta = $roleMeta[$slug] ?? ['name' => ucfirst($slug), 'description' => null, 'is_system' => false];

            $role = Role::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $meta['name'],
                    'description' => $meta['description'],
                    'is_system' => $meta['is_system'],
                ]
            );

            $permissionIds = Permission::whereIn('name', $permissions)->pluck('id');
            $role->permissions()->sync($permissionIds);
        }
    }
}
