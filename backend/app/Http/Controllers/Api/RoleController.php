<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Support\Permission as PermissionDef;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index()
    {
        $roles = Role::withCount('users')
            ->with('permissions:id,name,label,group')
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role) => $this->formatRole($role));

        return response()->json($roles);
    }

    public function permissionsCatalog()
    {
        $permissions = Permission::orderBy('group')->orderBy('label')->get()
            ->groupBy('group')
            ->map(fn ($items, $group) => [
                'group' => $group,
                'group_label' => $this->groupLabel($group),
                'permissions' => $items,
            ])
            ->values();

        return response()->json($permissions);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'nullable|string|max:50|alpha_dash|unique:roles,slug',
            'description' => 'nullable|string|max:500',
            'permissions' => 'array',
            'permissions.*' => ['string', Rule::in(PermissionDef::all())],
        ]);

        $slug = $data['slug'] ?? Str::slug($data['name'], '_');

        $role = Role::create([
            'slug' => $slug,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'is_system' => false,
        ]);

        $this->syncPermissions($role, $data['permissions'] ?? []);

        return response()->json($this->formatRole($role->load('permissions')->loadCount('users')), 201);
    }

    public function show(Role $role)
    {
        $role->load('permissions')->loadCount('users');

        return response()->json($this->formatRole($role));
    }

    public function update(Request $request, Role $role)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
            'permissions' => 'array',
            'permissions.*' => ['string', Rule::in(PermissionDef::all())],
        ]);

        if (isset($data['name'])) {
            $role->name = $data['name'];
        }
        if (array_key_exists('description', $data)) {
            $role->description = $data['description'];
        }
        $role->save();

        if (array_key_exists('permissions', $data) && $role->slug !== 'admin') {
            $this->syncPermissions($role, $data['permissions']);
        }

        return response()->json($this->formatRole($role->fresh()->load('permissions')->loadCount('users')));
    }

    public function destroy(Role $role)
    {
        if ($role->is_system) {
            return response()->json(['message' => 'Role sistem tidak dapat dihapus.'], 422);
        }

        if ($role->users()->exists()) {
            return response()->json(['message' => 'Role masih digunakan oleh pengguna. Pindahkan user terlebih dahulu.'], 422);
        }

        $role->delete();

        return response()->json(['message' => 'Role dihapus.']);
    }

    private function syncPermissions(Role $role, array $permissionNames): void
    {
        $ids = Permission::whereIn('name', $permissionNames)->pluck('id');
        $role->permissions()->sync($ids);
    }

    /** @return array<string, mixed> */
    private function formatRole(Role $role): array
    {
        return [
            'id' => $role->id,
            'slug' => $role->slug,
            'name' => $role->name,
            'description' => $role->description,
            'is_system' => $role->is_system,
            'users_count' => $role->users_count ?? $role->users()->count(),
            'permissions' => $role->relationLoaded('permissions')
                ? $role->permissions->pluck('name')->values()->all()
                : $role->permissionNames(),
            'permission_details' => $role->relationLoaded('permissions') ? $role->permissions : [],
        ];
    }

    private function groupLabel(string $group): string
    {
        return match ($group) {
            'dashboard' => 'Dashboard',
            'work_orders' => 'Work Order',
            'activities' => 'Aktivitas Mekanik',
            'parts' => 'Parts & Consumable',
            'inspection' => 'Inspection',
            'reports' => 'Laporan',
            'master' => 'Master Data',
            'administration' => 'Administrasi',
            default => ucfirst($group),
        };
    }
}
