<?php

namespace App\Models;

use App\Support\Permission;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name', 'username', 'email', 'password', 'employee_id', 'role', 'department', 'is_active',
    ];

    public static function normalizeUsername(string $value): string
    {
        return strtolower(preg_replace('/[^a-z0-9._-]+/i', '', $value) ?? '');
    }

    public static function makeUniqueUsername(string $base): string
    {
        $base = self::normalizeUsername($base);
        if ($base === '') {
            $base = 'user';
        }

        if (! self::where('username', $base)->exists()) {
            return $base;
        }

        $n = 2;
        while (self::where('username', "{$base}{$n}")->exists()) {
            $n++;
        }

        return "{$base}{$n}";
    }

    public static function suggestUsername(string $name, ?string $employeeId = null, ?string $email = null): string
    {
        if ($employeeId) {
            $fromNik = self::normalizeUsername($employeeId);
            if ($fromNik !== '') {
                return self::makeUniqueUsername($fromNik);
            }
        }

        if ($email && str_contains($email, '@')) {
            $local = strstr($email, '@', true) ?: $email;
            $fromEmail = self::normalizeUsername($local);
            if ($fromEmail !== '') {
                return self::makeUniqueUsername($fromEmail);
            }
        }

        $fromName = strtolower(preg_replace('/[^a-z0-9]+/i', '.', $name) ?? '');
        $fromName = trim($fromName, '.');

        return self::makeUniqueUsername($fromName !== '' ? str_replace('.', '', $fromName) : 'user');
    }

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function createdWorkOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class, 'created_by');
    }

    public function mechanicActivities(): HasMany
    {
        return $this->hasMany(MechanicActivity::class);
    }

    public function roleModel(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role', 'slug');
    }

    /** @return list<string> */
    public function permissionNames(): array
    {
        if ($this->role === 'admin') {
            return Permission::all();
        }

        if (Schema::hasTable('roles')) {
            $roleModel = $this->roleModel;
            if ($roleModel) {
                return $roleModel->permissionNames();
            }
        }

        return Permission::matrix()[$this->role] ?? [];
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->role === 'admin') {
            return true;
        }

        return in_array($permission, $this->permissionNames(), true);
    }

    public function isSupervisor(): bool
    {
        return $this->hasPermission(Permission::WORK_ORDERS_APPROVE);
    }

    public function isPlanner(): bool
    {
        return $this->hasPermission(Permission::WORK_ORDERS_CREATE);
    }

    public function isLogistic(): bool
    {
        return $this->hasPermission(Permission::PARTS_LOGISTIC);
    }

    public function isMechanic(): bool
    {
        return $this->role === 'mechanic';
    }
}
