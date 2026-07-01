<?php

namespace App\Services;

use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderStatusLog;
use InvalidArgumentException;

class WorkOrderService
{
    public function generateWoNumber(string $type = 'main', ?int $parentId = null): string
    {
        if ($type === 'sub') {
            if (! $parentId) {
                throw new InvalidArgumentException('parent_id wajib untuk Sub WO.');
            }

            return $this->generateSubWoNumber($parentId);
        }

        $prefix = 'WO-ADIKARA';
        $last = WorkOrder::where('type', 'main')
            ->where('wo_number', 'like', $prefix.'-%')
            ->orderByDesc('id')
            ->value('wo_number');

        $seq = 1;
        if ($last && preg_match('/(\d+)$/', $last, $m)) {
            $seq = (int) $m[1] + 1;
        }

        return sprintf('%s-%03d', $prefix, $seq);
    }

    public function generateSubWoNumber(int $parentId): string
    {
        $parent = WorkOrder::query()->findOrFail($parentId);
        if ($parent->type !== 'main') {
            throw new InvalidArgumentException('Parent Work Order harus bertipe main.');
        }

        $base = $parent->wo_number;
        $pattern = '/^'.preg_quote($base, '/').'-([A-Z]+)$/i';
        $maxIndex = 0;

        WorkOrder::query()
            ->where('parent_id', $parentId)
            ->pluck('wo_number')
            ->each(function (string $woNumber) use ($pattern, &$maxIndex) {
                if (preg_match($pattern, $woNumber, $matches)) {
                    $maxIndex = max($maxIndex, $this->suffixToIndex(strtoupper($matches[1])));
                }
            });

        return $base.'-'.$this->indexToSuffix($maxIndex + 1);
    }

    private function suffixToIndex(string $suffix): int
    {
        $index = 0;
        foreach (str_split($suffix) as $char) {
            $index = $index * 26 + (ord($char) - ord('A') + 1);
        }

        return $index;
    }

    private function indexToSuffix(int $index): string
    {
        $suffix = '';
        while ($index > 0) {
            $index--;
            $suffix = chr(ord('A') + ($index % 26)).$suffix;
            $index = intdiv($index, 26);
        }

        return $suffix !== '' ? $suffix : 'A';
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
