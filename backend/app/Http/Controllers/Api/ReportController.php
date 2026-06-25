<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\MechanicActivity;
use App\Models\PartsRequestItem;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    private const DELAY_CAUSE_LABELS = [
        'spare_part' => 'Spare part',
        'manpower' => 'Manpower',
        'tools' => 'Tools / peralatan',
        'other' => 'Lainnya',
    ];

    public function productivity()
    {
        $data = MechanicActivity::query()
            ->join('activity_types', 'activity_types.id', '=', 'mechanic_activities.activity_type_id')
            ->where('mechanic_activities.status', 'approved')
            ->select(
                'activity_types.category',
                DB::raw('SUM(mechanic_activities.total_hours) as total_hours'),
                DB::raw('COUNT(*) as activity_count')
            )
            ->groupBy('activity_types.category')
            ->get();

        return response()->json($data);
    }

    public function leadTime()
    {
        $orders = WorkOrder::whereNotNull('opened_at')
            ->select(
                'wo_number',
                'title',
                'status',
                'target_hours',
                'estimated_hours',
                'actual_hours',
                'opened_at',
                'closed_at'
            )
            ->latest('opened_at')
            ->limit(100)
            ->get()
            ->map(function ($wo) {
                $targetHours = (float) ($wo->target_hours ?? $wo->estimated_hours ?? 0);
                $actualHours = (float) $wo->actual_hours;
                $leadDays = $wo->opened_at && $wo->closed_at
                    ? $wo->opened_at->diffInDays($wo->closed_at)
                    : null;

                return [
                    'wo_number' => $wo->wo_number,
                    'title' => $wo->title,
                    'status' => $wo->status,
                    'target_hours' => round($targetHours, 2),
                    'actual_hours' => round($actualHours, 2),
                    'variance_hours' => round($actualHours - $targetHours, 2),
                    'lead_days' => $leadDays,
                    'opened_at' => $wo->opened_at,
                    'closed_at' => $wo->closed_at,
                ];
            });

        return response()->json($orders);
    }

    public function mechanicPerformance()
    {
        $data = MechanicActivity::query()
            ->join('users', 'users.id', '=', 'mechanic_activities.user_id')
            ->where('mechanic_activities.status', 'approved')
            ->select(
                'users.id',
                'users.name',
                'users.employee_id',
                DB::raw('SUM(mechanic_activities.total_hours) as total_hours'),
                DB::raw('COUNT(DISTINCT mechanic_activities.work_order_id) as wo_count')
            )
            ->groupBy('users.id', 'users.name', 'users.employee_id')
            ->orderByDesc('total_hours')
            ->get();

        return response()->json($data);
    }

    public function sparePartConsumption()
    {
        $data = PartsRequestItem::query()
            ->join('parts_requests', 'parts_requests.id', '=', 'parts_request_items.parts_request_id')
            ->whereIn('parts_requests.status', ['approved', 'logistic_check', 'taken'])
            ->select(
                'parts_request_items.part_name',
                DB::raw('SUM(parts_request_items.qty) as total_qty'),
                DB::raw('SUM(parts_request_items.qty * parts_request_items.unit_cost) as total_cost')
            )
            ->groupBy('parts_request_items.part_name')
            ->orderByDesc('total_qty')
            ->limit(20)
            ->get();

        return response()->json($data);
    }

    public function costReport(Request $request)
    {
        $laborRate = AppSetting::laborHourlyRate();
        $orders = $this->filteredWorkOrdersQuery($request)->orderBy('wo_number')->get();
        $woIds = $orders->pluck('id');

        $materialByWo = $this->materialCostByWorkOrderIds($woIds);
        $hoursByWo = $this->laborHoursByWorkOrderIds($woIds);

        $rows = $orders->map(function (WorkOrder $wo) use ($materialByWo, $hoursByWo, $laborRate) {
            $material = round((float) ($materialByWo[$wo->id] ?? 0), 2);
            $hours = round((float) ($hoursByWo[$wo->id] ?? 0), 2);
            $labor = round($hours * $laborRate, 2);

            return [
                'id' => $wo->id,
                'wo_number' => $wo->wo_number,
                'title' => $wo->title,
                'status' => $wo->status,
                'type' => $wo->type,
                'workshop' => $wo->workshop,
                'main_category' => $wo->main_category,
                'material_cost' => $material,
                'labor_hours' => $hours,
                'labor_cost' => $labor,
                'total_cost' => round($material + $labor, 2),
                'opened_at' => $wo->opened_at,
                'closed_at' => $wo->closed_at,
            ];
        })->sortByDesc('total_cost')->values();

        $summary = [
            'work_order_count' => $rows->count(),
            'total_material_cost' => round($rows->sum('material_cost'), 2),
            'total_labor_hours' => round($rows->sum('labor_hours'), 2),
            'total_labor_cost' => round($rows->sum('labor_cost'), 2),
            'total_cost' => round($rows->sum('total_cost'), 2),
        ];

        $perPage = min(100, max(10, $request->integer('per_page', 25)));
        $page = max(1, $request->integer('page', 1));
        $total = $rows->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $items = $rows->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json([
            'labor_hourly_rate' => $laborRate,
            'summary' => $summary,
            'data' => $items,
            'current_page' => $page,
            'last_page' => $lastPage,
            'total' => $total,
            'per_page' => $perPage,
        ]);
    }

    public function workOrderHistory(Request $request)
    {
        return response()->json(
            $this->filteredWorkOrdersQuery($request)
                ->with('creator')
                ->latest()
                ->paginate($request->integer('per_page', 25))
        );
    }

    /** @return Builder<WorkOrder> */
    private function filteredWorkOrdersQuery(Request $request): Builder
    {
        $query = WorkOrder::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('search')) {
            $search = '%'.$request->search.'%';
            $query->where(function ($q) use ($search) {
                $q->where('wo_number', 'like', $search)
                    ->orWhere('title', 'like', $search)
                    ->orWhere('component_name', 'like', $search)
                    ->orWhere('unit_model', 'like', $search);
            });
        }
        if ($request->filled('from_date')) {
            $query->whereDate('opened_at', '>=', $request->date('from_date'));
        }
        if ($request->filled('to_date')) {
            $query->whereDate('opened_at', '<=', $request->date('to_date'));
        }

        return $query;
    }

    /** @return array<int, float> */
    private function materialCostByWorkOrderIds(Collection $woIds): array
    {
        if ($woIds->isEmpty()) {
            return [];
        }

        return PartsRequestItem::query()
            ->join('parts_requests', 'parts_requests.id', '=', 'parts_request_items.parts_request_id')
            ->whereIn('parts_requests.work_order_id', $woIds)
            ->whereIn('parts_requests.status', ['approved', 'logistic_check', 'taken'])
            ->groupBy('parts_requests.work_order_id')
            ->select(
                'parts_requests.work_order_id',
                DB::raw('SUM(parts_request_items.qty * parts_request_items.unit_cost) as material_cost')
            )
            ->pluck('material_cost', 'work_order_id')
            ->map(fn ($v) => (float) $v)
            ->all();
    }

    /** @return array<int, float> */
    private function laborHoursByWorkOrderIds(Collection $woIds): array
    {
        if ($woIds->isEmpty()) {
            return [];
        }

        return MechanicActivity::query()
            ->whereIn('work_order_id', $woIds)
            ->where('status', 'approved')
            ->groupBy('work_order_id')
            ->select('work_order_id', DB::raw('SUM(total_hours) as labor_hours'))
            ->pluck('labor_hours', 'work_order_id')
            ->map(fn ($v) => (float) $v)
            ->all();
    }

    public function mechanicActivityHistory(Request $request)
    {
        $query = MechanicActivity::with(['user', 'workOrder', 'activityType'])
            ->latest('activity_date')
            ->latest('id');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }
        if ($request->filled('mode')) {
            $query->where('mode', $request->mode);
        }
        if ($request->filled('category')) {
            $query->whereHas('activityType', fn ($q) => $q->where('category', $request->category));
        }
        if ($request->filled('work_order_id')) {
            $query->where('work_order_id', $request->integer('work_order_id'));
        }

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function unitComponentHistory(Request $request)
    {
        $groupBy = $request->input('group_by', 'unit');
        if (! in_array($groupBy, ['unit', 'component'], true)) {
            return response()->json(['message' => 'group_by harus unit atau component.'], 422);
        }

        $orders = $this->filteredWorkOrdersQuery($request)
            ->whereNotNull('opened_at')
            ->orderByDesc('opened_at')
            ->get();

        $groups = [];

        foreach ($orders as $wo) {
            if ($groupBy === 'unit') {
                if (! $wo->unit_number && ! $wo->unit_model) {
                    continue;
                }
                $key = trim(($wo->unit_model ?? '').'|'.($wo->unit_number ?? ''));
                $label = trim(($wo->unit_model ? $wo->unit_model.' — ' : '').($wo->unit_number ?? 'Tanpa nomor'));
            } else {
                if (! $wo->component_name) {
                    continue;
                }
                $key = trim(($wo->component_name ?? '').'|'.($wo->component_serial ?? ''));
                $label = $wo->component_name.($wo->component_serial ? ' ('.$wo->component_serial.')' : '');
            }

            if ($key === '|' || $key === '') {
                continue;
            }

            if (! isset($groups[$key])) {
                $groups[$key] = [
                    'key' => $key,
                    'label' => $label,
                    'repair_count' => 0,
                    'closed_count' => 0,
                    'open_count' => 0,
                    'last_wo_number' => null,
                    'last_opened_at' => null,
                    'last_status' => null,
                    'component_installed_at' => null,
                    'component_age_days' => null,
                    'work_orders' => [],
                ];
            }

            $groups[$key]['repair_count']++;
            if ($wo->status === 'closed') {
                $groups[$key]['closed_count']++;
            } else {
                $groups[$key]['open_count']++;
            }

            if ($wo->component_installed_at) {
                $groups[$key]['component_installed_at'] = $wo->component_installed_at->toDateString();
                $groups[$key]['component_age_days'] = $wo->component_installed_at->diffInDays(now());
            }

            $groups[$key]['work_orders'][] = [
                'id' => $wo->id,
                'wo_number' => $wo->wo_number,
                'title' => $wo->title,
                'status' => $wo->status,
                'opened_at' => $wo->opened_at,
                'closed_at' => $wo->closed_at,
            ];

            if (
                ! $groups[$key]['last_opened_at']
                || $wo->opened_at?->gt($groups[$key]['last_opened_at'])
            ) {
                $groups[$key]['last_wo_number'] = $wo->wo_number;
                $groups[$key]['last_opened_at'] = $wo->opened_at;
                $groups[$key]['last_status'] = $wo->status;
            }
        }

        $rows = collect($groups)
            ->map(function (array $g) {
                $g['failure_frequency'] = $g['repair_count'];
                unset($g['work_orders']);

                return $g;
            })
            ->sortByDesc('repair_count')
            ->values();

        $perPage = min(100, max(10, $request->integer('per_page', 25)));
        $page = max(1, $request->integer('page', 1));
        $total = $rows->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);

        return response()->json([
            'group_by' => $groupBy,
            'summary' => [
                'group_count' => $total,
                'total_repairs' => $rows->sum('repair_count'),
            ],
            'data' => $rows->slice(($page - 1) * $perPage, $perPage)->values(),
            'current_page' => $page,
            'last_page' => $lastPage,
            'total' => $total,
            'per_page' => $perPage,
        ]);
    }

    public function delayAnalysis(Request $request)
    {
        $orders = $this->filteredWorkOrdersQuery($request)
            ->whereNotNull('opened_at')
            ->get();

        $woIds = $orders->pluck('id');
        $outstandingWoIds = $this->workOrderIdsWithOutstandingParts($woIds);

        $manualCounts = array_fill_keys(array_keys(self::DELAY_CAUSE_LABELS), 0);
        $inferredCounts = [
            'spare_part' => 0,
            'manpower' => 0,
        ];
        $rows = [];

        foreach ($orders as $wo) {
            $targetHours = (float) ($wo->target_hours ?? $wo->estimated_hours ?? 0);
            $actualHours = (float) $wo->actual_hours;
            $overTarget = $targetHours > 0 && $actualHours > $targetHours * 1.1;
            $hasOutstanding = $outstandingWoIds->contains($wo->id);

            $effectiveCause = $wo->delay_cause;
            $source = $wo->delay_cause ? 'manual' : null;

            if (! $effectiveCause && $hasOutstanding) {
                $effectiveCause = 'spare_part';
                $source = 'inferred';
                $inferredCounts['spare_part']++;
            } elseif (! $effectiveCause && $overTarget) {
                $effectiveCause = 'manpower';
                $source = 'inferred';
                $inferredCounts['manpower']++;
            }

            if ($wo->delay_cause) {
                $manualCounts[$wo->delay_cause]++;
            }

            if (! $effectiveCause) {
                continue;
            }

            $rows[] = [
                'id' => $wo->id,
                'wo_number' => $wo->wo_number,
                'title' => $wo->title,
                'status' => $wo->status,
                'delay_cause' => $effectiveCause,
                'delay_cause_label' => self::DELAY_CAUSE_LABELS[$effectiveCause] ?? $effectiveCause,
                'delay_notes' => $wo->delay_notes,
                'source' => $source,
                'manual_delay_cause' => $wo->delay_cause,
                'has_outstanding_parts' => $hasOutstanding,
                'target_hours' => round($targetHours, 2),
                'actual_hours' => round($actualHours, 2),
                'variance_hours' => round($actualHours - $targetHours, 2),
                'opened_at' => $wo->opened_at,
                'closed_at' => $wo->closed_at,
            ];
        }

        $byCause = collect(array_keys(self::DELAY_CAUSE_LABELS))->map(fn ($cause) => [
            'cause' => $cause,
            'label' => self::DELAY_CAUSE_LABELS[$cause],
            'manual_count' => $manualCounts[$cause] ?? 0,
            'inferred_count' => $inferredCounts[$cause] ?? 0,
            'total' => ($manualCounts[$cause] ?? 0) + ($inferredCounts[$cause] ?? 0),
        ]);

        return response()->json([
            'delay_cause_labels' => self::DELAY_CAUSE_LABELS,
            'summary' => [
                'delayed_work_orders' => count($rows),
                'manual_total' => array_sum($manualCounts),
                'inferred_spare_part' => $inferredCounts['spare_part'],
                'inferred_manpower' => $inferredCounts['manpower'],
            ],
            'by_cause' => $byCause,
            'work_orders' => collect($rows)->sortByDesc('opened_at')->values(),
        ]);
    }

    public function utilization(Request $request)
    {
        $standardHours = AppSetting::standardHoursPerDay();
        $from = $request->date('from_date') ?? now()->subDays(30)->startOfDay();
        $to = $request->date('to_date') ?? now()->endOfDay();
        if ($from->gt($to)) {
            [$from, $to] = [$to, $from];
        }

        $workDays = max(1, $from->diffInWeekdays($to) + 1);

        $rows = MechanicActivity::query()
            ->join('users', 'users.id', '=', 'mechanic_activities.user_id')
            ->where('mechanic_activities.status', 'approved')
            ->whereBetween('mechanic_activities.activity_date', [$from->toDateString(), $to->toDateString()])
            ->select(
                'users.id',
                'users.name',
                'users.employee_id',
                DB::raw('SUM(mechanic_activities.total_hours) as total_hours'),
                DB::raw('COUNT(DISTINCT mechanic_activities.activity_date) as active_days')
            )
            ->groupBy('users.id', 'users.name', 'users.employee_id')
            ->orderByDesc('total_hours')
            ->get()
            ->map(function ($row) use ($standardHours, $workDays) {
                $hours = round((float) $row->total_hours, 2);
                $capacity = round($workDays * $standardHours, 2);
                $pct = $capacity > 0 ? round(($hours / $capacity) * 100, 1) : 0;
                $band = $pct < 60 ? 'idle' : ($pct > 100 ? 'overload' : 'normal');

                return [
                    'user_id' => $row->id,
                    'name' => $row->name,
                    'employee_id' => $row->employee_id,
                    'total_hours' => $hours,
                    'active_days' => (int) $row->active_days,
                    'capacity_hours' => $capacity,
                    'utilization_pct' => $pct,
                    'band' => $band,
                    'band_label' => match ($band) {
                        'idle' => 'Idle (under-utilized)',
                        'overload' => 'Overload',
                        default => 'Normal',
                    },
                ];
            });

        $summary = [
            'from_date' => $from->toDateString(),
            'to_date' => $to->toDateString(),
            'work_days' => $workDays,
            'standard_hours_per_day' => $standardHours,
            'mechanic_count' => $rows->count(),
            'idle_count' => $rows->where('band', 'idle')->count(),
            'normal_count' => $rows->where('band', 'normal')->count(),
            'overload_count' => $rows->where('band', 'overload')->count(),
            'avg_utilization_pct' => $rows->count() > 0
                ? round($rows->avg('utilization_pct'), 1)
                : 0,
        ];

        return response()->json([
            'summary' => $summary,
            'data' => $rows->values(),
        ]);
    }

    /** @return \Illuminate\Support\Collection<int, int> */
    private function workOrderIdsWithOutstandingParts(Collection $woIds): Collection
    {
        if ($woIds->isEmpty()) {
            return collect();
        }

        return PartsRequestItem::query()
            ->join('parts_requests', 'parts_requests.id', '=', 'parts_request_items.parts_request_id')
            ->whereIn('parts_requests.work_order_id', $woIds)
            ->where(function ($q) {
                $q->where('parts_request_items.is_outstanding', true)
                    ->orWhereIn('parts_requests.status', ['pending', 'submitted', 'supervisor_review']);
            })
            ->distinct()
            ->pluck('parts_requests.work_order_id');
    }
}
