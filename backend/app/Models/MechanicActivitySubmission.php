<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MechanicActivitySubmission extends Model
{
    protected $fillable = [
        'user_id',
        'activity_date',
        'status',
        'activities_count',
        'total_hours',
        'submitted_at',
        'approved_by',
        'approved_at',
        'supervisor_notes',
    ];

    protected function casts(): array
    {
        return [
            'activity_date' => 'date',
            'total_hours' => 'decimal:2',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(MechanicActivity::class, 'submission_id')
            ->orderBy('start_time');
    }

    public function refreshTotals(): void
    {
        $this->activities_count = $this->activities()->count();
        $this->total_hours = (float) $this->activities()->sum('total_hours');
        $this->save();
    }

    public function syncStatusFromActivities(?int $approverId = null): void
    {
        $statuses = $this->activities()->pluck('status');

        if ($statuses->isEmpty()) {
            return;
        }

        if ($statuses->contains('pending_approval')) {
            $this->update(['status' => 'pending_approval']);

            return;
        }

        if ($statuses->every(fn (string $status) => $status === 'approved')) {
            $this->update([
                'status' => 'approved',
                'approved_by' => $approverId ?? $this->approved_by,
                'approved_at' => $this->approved_at ?? now(),
            ]);

            return;
        }

        if ($statuses->every(fn (string $status) => $status === 'rejected')) {
            $this->update([
                'status' => 'rejected',
                'approved_by' => null,
                'approved_at' => null,
            ]);

            return;
        }

        $this->update([
            'status' => 'approved',
            'approved_by' => $approverId ?? $this->approved_by,
            'approved_at' => $this->approved_at ?? now(),
        ]);
    }

    public function isEditableByMechanic(): bool
    {
        return in_array($this->status, ['draft', 'rejected'], true);
    }
}
