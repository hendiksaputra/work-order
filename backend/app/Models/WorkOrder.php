<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkOrder extends Model
{
    /** Status WO/Sub WO yang belum boleh dipakai untuk aktivitas mekanik. */
    public const ACTIVITY_INELIGIBLE_STATUSES = [
        'draft',
        'pending_supervisor',
        'rejected',
        'closed',
    ];

    protected $fillable = [
        'wo_number', 'type', 'parent_id', 'main_category', 'workshop', 'department',
        'title', 'description', 'component_name', 'component_serial',
        'unit_model', 'unit_number', 'location', 'status',
        'operational_status', 'operational_status_notes',
        'manpower_count', 'estimated_hours', 'target_hours', 'actual_hours',
        'material_cost', 'work_details', 'supervisor_notes',
        'created_by', 'opened_at', 'closed_at',
        'delay_cause', 'delay_notes', 'component_installed_at',
    ];

    protected function casts(): array
    {
        return [
            'estimated_hours' => 'decimal:2',
            'target_hours' => 'decimal:2',
            'actual_hours' => 'decimal:2',
            'material_cost' => 'decimal:2',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'component_installed_at' => 'date',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class, 'parent_id');
    }

    public function subWorkOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class, 'parent_id')->orderBy('wo_number');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isVisibleTo(User $viewer): bool
    {
        if ($viewer->canViewAllDepartments()) {
            return true;
        }

        $department = trim((string) ($viewer->department ?? ''));

        if ($this->locationMatches($department)) {
            return true;
        }

        if ($this->type !== 'main') {
            return false;
        }

        return $this->subWorkOrders()
            ->where(function ($query) use ($department) {
                self::applyWorkshopLocationFilter($query, $department);
            })
            ->exists();
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<WorkOrder>  $query
     */
    public function scopeVisibleTo($query, User $viewer): void
    {
        if ($viewer->canViewAllDepartments()) {
            return;
        }

        $department = trim((string) ($viewer->department ?? ''));

        $query->where(function ($outer) use ($department) {
            self::applyWorkshopLocationFilter($outer, $department);

            $outer->orWhere(function ($mainQuery) use ($department) {
                $mainQuery
                    ->where('type', 'main')
                    ->whereHas('subWorkOrders', function ($subQuery) use ($department) {
                        self::applyWorkshopLocationFilter($subQuery, $department);
                    });
            });
        });
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<WorkOrder>  $query
     */
    private static function applyWorkshopLocationFilter($query, string $department): void
    {
        if ($department === '') {
            $query->where(function ($inner) {
                $inner->whereNull('workshop')->orWhere('workshop', '');
            });

            return;
        }

        $query->whereRaw('LOWER(workshop) = ?', [strtolower($department)]);
    }

    private function locationMatches(string $department): bool
    {
        $workshop = trim((string) ($this->workshop ?? ''));

        if ($workshop === '') {
            return $department === '';
        }

        return strtolower($workshop) === strtolower($department);
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<WorkOrder>  $query
     */
    public function scopeActivityEligible($query)
    {
        return $query->whereNotIn('status', self::ACTIVITY_INELIGIBLE_STATUSES);
    }

    /** WO yang menunggu tindakan persetujuan supervisor. */
    public function scopePendingSupervisorApproval($query)
    {
        return $query->where(function ($q) {
            $q->where('status', 'pending_supervisor')
                ->orWhere(function ($q2) {
                    $q2->where('status', 'draft')
                        ->whereHas('creator', fn ($c) => $c->where('role', 'supervisor'));
                });
        });
    }

    public function statusLogs(): HasMany
    {
        return $this->hasMany(WorkOrderStatusLog::class);
    }

    public function mechanicActivities(): HasMany
    {
        return $this->hasMany(MechanicActivity::class);
    }

    public function partsRequests(): HasMany
    {
        return $this->hasMany(PartsRequest::class);
    }

    /** Ada aktivitas working yang masih relevan untuk eksekusi WO. */
    public function hasWorkingActivities(): bool
    {
        return $this->mechanicActivities()
            ->where('mode', 'working')
            ->where('status', '!=', 'rejected')
            ->exists();
    }

    /**
     * Jika WO sudah Finish (in_execution) tetapi tidak ada aktivitas working,
     * kembalikan ke approved agar progress Main WO konsisten dengan data mekanik.
     */
    public function reconcileExecutionStatusFromActivities(?User $actedBy = null): bool
    {
        if ($this->status !== 'in_execution' || $this->hasWorkingActivities()) {
            return false;
        }

        $from = $this->status;
        $this->status = 'approved';
        $this->save();

        WorkOrderStatusLog::create([
            'work_order_id' => $this->id,
            'from_status' => $from,
            'to_status' => 'approved',
            'changed_by' => $actedBy?->id,
            'notes' => 'Otomatis: semua aktivitas mekanik pada WO ini telah dihapus.',
        ]);

        return true;
    }

    public function refreshWorkDetails(): void
    {
        $activities = $this->mechanicActivities()
            ->where('status', 'approved')
            ->with('activityType', 'user')
            ->get();

        $parts = $this->partsRequests()
            ->whereIn('status', ['approved', 'logistic_check', 'taken'])
            ->with('items')
            ->get();

        $activitySummary = $activities->map(fn ($a) => sprintf(
            '- %s: %s (%s jam) - %s',
            $a->activity_date->format('d/m/Y'),
            $a->activityType->name,
            $a->total_hours,
            $a->user->name
        ))->implode("\n");

        $partsSummary = $parts->flatMap(fn ($pr) => $pr->items->map(fn ($item) => sprintf(
            '- %s x %s %s',
            $item->part_name,
            $item->qty,
            $item->unit
        )))->implode("\n");

        $this->actual_hours = $activities->sum('total_hours');
        $this->material_cost = $parts->flatMap->items->sum(fn ($i) => $i->qty * $i->unit_cost);
        $this->work_details = "=== Aktivitas Mekanik ===\n".($activitySummary ?: '-')."\n\n=== Parts & Consumable ===\n".($partsSummary ?: '-');
        $this->save();
    }
}
