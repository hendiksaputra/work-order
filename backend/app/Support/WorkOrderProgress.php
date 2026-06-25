<?php

namespace App\Support;

use App\Models\WorkOrder;
use Illuminate\Support\Collection;

class WorkOrderProgress
{
    /** @var list<string> */
    public const SUB_FINISHED_STATUSES = [
        'in_execution',
        'qc_pending',
        'qc_approved',
        'closed',
    ];

    public static function isSubWorkflowFinished(string $status): bool
    {
        return in_array($status, self::SUB_FINISHED_STATUSES, true);
    }

    public static function isSubProgressComplete(WorkOrder $sub): bool
    {
        if (! self::isSubWorkflowFinished($sub->status)) {
            return false;
        }

        if (! WorkOrderMechanicProgress::hasWorkingActivities($sub)) {
            return false;
        }

        return WorkOrderMechanicProgress::isCrewComplete($sub);
    }

    public static function percentFor(WorkOrder $workOrder): int
    {
        if ($workOrder->type === 'main') {
            /** @var Collection<int, WorkOrder> $subs */
            $subs = $workOrder->relationLoaded('subWorkOrders')
                ? $workOrder->subWorkOrders
                : $workOrder->subWorkOrders()->get();

            if ($subs->isEmpty()) {
                return self::isSubProgressComplete($workOrder) ? 100 : 0;
            }

            $total = $subs->count();
            $finished = $subs->filter(
                fn (WorkOrder $sub) => self::isSubProgressComplete($sub)
            )->count();

            return (int) round(($finished / $total) * 100);
        }

        return self::isSubProgressComplete($workOrder) ? 100 : 0;
    }
}
