<?php

namespace App\Models;

use App\Support\WorkshopSchedule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OvertimeRequest extends Model
{
    protected $fillable = [
        'user_id',
        'work_order_id',
        'activity_date',
        'overtime_start',
        'overtime_end',
        'reason',
        'status',
        'supervisor_notes',
        'approved_by',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'activity_date' => 'date',
            'approved_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public static function approvedForUserDate(int $userId, string $activityDate): ?self
    {
        return self::query()
            ->where('user_id', $userId)
            ->whereDate('activity_date', $activityDate)
            ->where('status', 'approved')
            ->orderByDesc('approved_at')
            ->first();
    }

    public function coversEndTime(string $endTime): bool
    {
        return WorkshopSchedule::timeToMinutes($endTime) <= WorkshopSchedule::timeToMinutes(
            substr((string) $this->overtime_end, 0, 5)
        );
    }
}
