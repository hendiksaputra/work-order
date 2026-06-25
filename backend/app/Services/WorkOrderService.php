<?php

namespace App\Services;

use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderStatusLog;
use Illuminate\Support\Str;

class WorkOrderService
{
    public function generateWoNumber(string $type = 'main'): string
    {
        $prefix = $type === 'main' ? 'WO-ADIKARA' : 'SWO-ADIKARA';
        $last = WorkOrder::where('wo_number', 'like', $prefix.'-%')
            ->orderByDesc('id')
            ->value('wo_number');

        $seq = 1;
        if ($last && preg_match('/(\d+)$/', $last, $m)) {
            $seq = (int) $m[1] + 1;
        }

        return sprintf('%s-%03d', $prefix, $seq);
    }

    public function transition(WorkOrder $wo, string $toStatus, User $user, ?string $notes = null): WorkOrder
    {
        $from = $wo->status;
        $wo->status = $toStatus;

        if ($toStatus === 'approved' && ! $wo->opened_at) {
            $wo->opened_at = now();
        }
        if ($toStatus === 'closed') {
            $wo->closed_at = now();
        }

        $wo->save();

        WorkOrderStatusLog::create([
            'work_order_id' => $wo->id,
            'from_status' => $from,
            'to_status' => $toStatus,
            'changed_by' => $user->id,
            'notes' => $notes,
        ]);

        return $wo->fresh();
    }
}
