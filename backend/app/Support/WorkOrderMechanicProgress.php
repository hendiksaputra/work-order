<?php

namespace App\Support;

use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;

class WorkOrderMechanicProgress
{
    public static function approvedMechanicsCount(WorkOrder $workOrder): int
    {
        if (isset($workOrder->approved_mechanics_count)) {
            return (int) $workOrder->approved_mechanics_count;
        }

        return (int) $workOrder->mechanicActivities()
            ->where('mode', 'working')
            ->where('status', 'approved')
            ->distinct('user_id')
            ->count('user_id');
    }

    /** Mekanik yang masih punya aktivitas draft / menunggu approval pada WO ini. */
    public static function openMechanicsCount(WorkOrder $workOrder): int
    {
        if (isset($workOrder->open_mechanics_count)) {
            return (int) $workOrder->open_mechanics_count;
        }

        return (int) $workOrder->mechanicActivities()
            ->where('mode', 'working')
            ->whereIn('status', ['draft', 'pending_approval'])
            ->distinct('user_id')
            ->count('user_id');
    }

    public static function targetManpower(WorkOrder $workOrder): int
    {
        return max(1, (int) $workOrder->manpower_count);
    }

    public static function isCrewComplete(WorkOrder $workOrder): bool
    {
        return self::approvedMechanicsCount($workOrder) >= self::targetManpower($workOrder)
            && self::openMechanicsCount($workOrder) === 0;
    }

    public static function hasWorkingActivities(WorkOrder $workOrder): bool
    {
        if (isset($workOrder->working_activities_count)) {
            return (int) $workOrder->working_activities_count > 0;
        }

        return $workOrder->mechanicActivities()
            ->where('mode', 'working')
            ->where('status', '!=', 'rejected')
            ->exists();
    }

    /** @return array{approved: int, target: int, open: int, complete: bool} */
    public static function summary(WorkOrder $workOrder): array
    {
        $approved = self::approvedMechanicsCount($workOrder);
        $target = self::targetManpower($workOrder);

        return [
            'approved' => $approved,
            'target' => $target,
            'open' => self::openMechanicsCount($workOrder),
            'complete' => $approved >= $target && self::openMechanicsCount($workOrder) === 0,
        ];
    }

    public static function subWorkOrdersWithMechanicCountsQuery(): \Closure
    {
        return function ($query) {
            $query->withCount(self::mechanicCountRelations());
        };
    }

    /** @return array<string, \Closure> */
    public static function mechanicCountRelations(): array
    {
        return [
            'mechanicActivities as working_activities_count' => fn ($q) => $q
                ->where('mode', 'working')
                ->where('status', '!=', 'rejected'),
            'mechanicActivities as approved_mechanics_count' => fn ($q) => $q
                ->where('mode', 'working')
                ->where('status', 'approved')
                ->select(DB::raw('count(distinct user_id)')),
            'mechanicActivities as open_mechanics_count' => fn ($q) => $q
                ->where('mode', 'working')
                ->whereIn('status', ['draft', 'pending_approval'])
                ->select(DB::raw('count(distinct user_id)')),
        ];
    }
}
