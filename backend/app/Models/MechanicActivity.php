<?php

namespace App\Models;

use App\Support\WorkshopSchedule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MechanicActivity extends Model
{
    protected $fillable = [
        'user_id', 'submission_id', 'work_order_id', 'activity_type_id', 'mode',
        'activity_date', 'start_time', 'end_time', 'total_hours',
        'notes', 'status', 'supervisor_notes', 'approved_by', 'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'activity_date' => 'date',
            'total_hours' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public static function calculateHours(
        string $start,
        string $end,
        bool $excludeLunch = true,
        ?string $activityDate = null
    ): float {
        $minutes = WorkshopSchedule::durationMinutes($start, $end);
        if ($excludeLunch) {
            $minutes -= WorkshopSchedule::lunchOverlapMinutes($start, $end, $activityDate);
        }

        return round(max(0, $minutes) / 60, 2);
    }

    /** @return list<array{type: 'work'|'break', start: string, end: string}> */
    public static function splitAroundLunchBreak(string $start, string $end, ?string $activityDate = null): array
    {
        return WorkshopSchedule::splitAroundLunchBreak($start, $end, $activityDate);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(MechanicActivitySubmission::class, 'submission_id');
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function activityType(): BelongsTo
    {
        return $this->belongsTo(ActivityType::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
