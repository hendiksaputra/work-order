<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\WorkOrderService;
use App\Support\Permission;
use App\Support\WorkOrderMechanicProgress;
use App\Support\WorkOrderOperationalStatus;
use App\Support\WorkOrderProgress;
use Illuminate\Http\Request;

class WorkOrderController extends Controller
{
    use AuthorizesRequests;

    /** Status WO/Sub WO yang belum boleh dipakai untuk aktivitas mekanik. */
    private const ACTIVITY_INELIGIBLE_STATUSES = ['draft', 'pending_supervisor', 'rejected', 'closed'];

    public function __construct(private WorkOrderService $woService) {}

    public function index(Request $request)
    {
        $query = WorkOrder::with([
            'creator',
            'parent',
            'subWorkOrders' => WorkOrderMechanicProgress::subWorkOrdersWithMechanicCountsQuery(),
        ])
            ->withCount(WorkOrderMechanicProgress::mechanicCountRelations())
            ->latest();

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('workshop')) {
            $query->where('workshop', $request->workshop);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('wo_number', 'like', "%{$s}%")
                    ->orWhere('title', 'like', "%{$s}%")
                    ->orWhere('component_name', 'like', "%{$s}%")
                    ->orWhere('unit_number', 'like', "%{$s}%");
            });
        }

        return response()->json($query->paginate($request->integer('per_page', 15)));
    }

    public function pendingApprovalCount()
    {
        $count = WorkOrder::pendingSupervisorApproval()->count();

        return response()->json([
            'count' => $count,
            'label' => 'WO belum disetujui supervisor',
        ]);
    }

    public function show(WorkOrder $workOrder)
    {
        $workOrder->load([
            'creator', 'parent.subWorkOrders', 'subWorkOrders',
            'mechanicActivities.activityType', 'mechanicActivities.user',
            'subWorkOrders.mechanicActivities.activityType',
            'subWorkOrders.mechanicActivities.user',
            'partsRequests.items',
            'subWorkOrders.partsRequests.items',
            'statusLogs.changer',
        ]);

        return response()->json($workOrder);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'type' => 'required|in:main,sub',
            'parent_id' => 'nullable|exists:work_orders,id',
            'main_category' => 'nullable|in:component,unit,other',
            'workshop' => 'nullable|in:rebuild,fabrication,support',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'component_name' => 'nullable|string|max:255',
            'component_serial' => 'nullable|string|max:255',
            'component_installed_at' => 'nullable|date',
            'unit_model' => 'nullable|string|max:255',
            'unit_number' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'manpower_count' => 'nullable|integer|min:1',
            'estimated_hours' => 'nullable|numeric|min:0',
            'target_hours' => 'nullable|numeric|min:0',
        ]);

        if ($data['type'] === 'main') {
            $request->validate(['main_category' => 'required|in:component,unit,other']);
            $data['main_category'] = $request->main_category;
        } else {
            $request->validate([
                'parent_id' => 'required|exists:work_orders,id',
                'workshop' => 'required|in:rebuild,fabrication,support',
            ]);
        }

        $user = $request->user();
        if ($data['type'] === 'main') {
            if (! $user->hasPermission(Permission::WORK_ORDERS_CREATE)) {
                return response()->json(['message' => 'Anda tidak memiliki izin membuat Main WO.'], 403);
            }
        } elseif (
            ! $user->hasPermission(Permission::WORK_ORDERS_SUB_CREATE)
            && ! $user->hasPermission(Permission::WORK_ORDERS_CREATE)
        ) {
            return response()->json(['message' => 'Anda tidak memiliki izin membuat Sub WO.'], 403);
        }

        if (! $request->user()->hasPermission(Permission::WORK_ORDERS_APPROVE)) {
            unset($data['manpower_count'], $data['estimated_hours']);
        }

        $wo = WorkOrder::create([
            ...$data,
            'wo_number' => $this->woService->generateWoNumber($data['type']),
            'status' => 'draft',
            'operational_status' => WorkOrderOperationalStatus::OPEN,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($wo->load('creator'), 201);
    }

    public function update(Request $request, WorkOrder $workOrder)
    {
        if ($denied = $this->denyUnless(
            $this->canEditWorkOrder($request, $workOrder),
            'Anda tidak memiliki izin mengubah Work Order ini.'
        )) {
            return $denied;
        }

        if (
            ! in_array($workOrder->status, ['draft', 'rejected'], true)
            && ! $request->user()->hasPermission(Permission::WORK_ORDERS_EDIT_ANY_STATUS)
        ) {
            return response()->json(['message' => 'WO tidak dapat diedit pada status ini.'], 422);
        }

        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'component_name' => 'nullable|string|max:255',
            'component_serial' => 'nullable|string|max:255',
            'component_installed_at' => 'nullable|date',
            'unit_model' => 'nullable|string|max:255',
            'unit_number' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'manpower_count' => 'nullable|integer|min:1',
            'estimated_hours' => 'nullable|numeric|min:0',
            'target_hours' => 'nullable|numeric|min:0',
            'delay_cause' => 'nullable|in:spare_part,manpower,tools,other',
            'delay_notes' => 'nullable|string|max:2000',
        ]);

        $reportOnly = collect(['delay_cause', 'delay_notes', 'component_installed_at'])
            ->filter(fn ($f) => array_key_exists($f, $data))
            ->keys()
            ->all();

        if (
            count($reportOnly) > 0
            && ! $request->user()->hasPermission(Permission::WORK_ORDERS_EDIT_ANY_STATUS)
            && ! $request->user()->hasPermission(Permission::WORK_ORDERS_APPROVE)
        ) {
            foreach ($reportOnly as $field) {
                unset($data[$field]);
            }
        }

        if (! $request->user()->hasPermission(Permission::WORK_ORDERS_APPROVE)) {
            unset($data['manpower_count'], $data['estimated_hours']);
        }

        $workOrder->update($data);

        return response()->json($workOrder->fresh());
    }

    public function updateOperationalFields(Request $request, WorkOrder $workOrder)
    {
        if ($denied = $this->denyUnless(
            $request->user()->hasPermission(Permission::WORK_ORDERS_APPROVE)
                || $request->user()->hasPermission(Permission::WORK_ORDERS_EDIT_ANY_STATUS),
            'Anda tidak memiliki izin mengubah data operasional WO.'
        )) {
            return $denied;
        }

        $data = $request->validate([
            'delay_cause' => 'nullable|in:spare_part,manpower,tools,other',
            'delay_notes' => 'nullable|string|max:2000',
            'component_installed_at' => 'nullable|date',
            'operational_status' => WorkOrderOperationalStatus::validationRule(),
            'operational_status_notes' => 'nullable|string|max:2000',
        ]);

        if (
            isset($data['operational_status'])
            && WorkOrderOperationalStatus::requiresFullProgress($data['operational_status'])
        ) {
            $workOrder->loadMissing('subWorkOrders');
            $percent = WorkOrderProgress::percentFor($workOrder);
            if ($percent < 100) {
                return response()->json([
                    'message' => "Status COMPLETED/CLOSED hanya bisa dipilih setelah progress WO 100% (saat ini {$percent}%).",
                ], 422);
            }
        }

        $workOrder->update($data);

        return response()->json($workOrder->fresh());
    }

    public function destroy(Request $request, WorkOrder $workOrder)
    {
        if ($denied = $this->denyUnless(
            $this->canDeleteWorkOrder($request, $workOrder),
            'Anda tidak memiliki izin menghapus Work Order ini.'
        )) {
            return $denied;
        }

        if (
            ! in_array($workOrder->status, ['draft', 'rejected'], true)
            && ! $request->user()->hasPermission(Permission::WORK_ORDERS_DELETE_ANY_STATUS)
        ) {
            return response()->json(['message' => 'Hanya WO draft atau ditolak yang dapat dihapus.'], 422);
        }

        if ($workOrder->type === 'main' && $workOrder->subWorkOrders()->exists()) {
            return response()->json([
                'message' => 'Main WO masih memiliki Sub WO. Hapus Sub WO terlebih dahulu.',
            ], 422);
        }

        $workOrder->delete();

        return response()->json(['message' => 'Work Order dihapus.']);
    }

    public function submit(Request $request, WorkOrder $workOrder)
    {
        if ($denied = $this->denyUnless(
            $this->canManageWorkOrder($request, $workOrder),
            'Anda tidak dapat mengajukan WO ini.'
        )) {
            return $denied;
        }

        if ($workOrder->status !== 'draft') {
            return response()->json(['message' => 'Hanya WO draft yang dapat diajukan.'], 422);
        }

        if ($this->isWorkOrderCreatedBySupervisor($workOrder)) {
            return response()->json([
                'message' => 'WO yang dibuat supervisor tidak perlu diajukan. Setujui langsung dari draft.',
            ], 422);
        }

        $this->woService->transition($workOrder, 'pending_supervisor', $request->user());

        $fresh = $workOrder->fresh();

        return response()->json(array_merge($fresh->toArray(), [
            'message' => "Work Order {$fresh->wo_number} berhasil diajukan. Menunggu persetujuan supervisor.",
        ]));
    }

    public function approve(Request $request, WorkOrder $workOrder)
    {
        $request->validate([
            'action' => 'required|in:approve,reject',
            'notes' => 'nullable|string',
            'next_status' => 'nullable|in:approved,in_execution,qc_pending,qc_approved,closed',
        ]);

        $action = $request->action;
        if ($action === 'reject') {
            $workOrder->supervisor_notes = $request->notes;
            $workOrder->save();
            $this->woService->transition($workOrder, 'rejected', $request->user(), $request->notes);

            $fresh = $workOrder->fresh();

            return response()->json(array_merge($fresh->toArray(), [
                'message' => "Work Order {$fresh->wo_number} ditolak supervisor.",
            ]));
        }

        if ($workOrder->status === 'draft') {
            if (! $this->isWorkOrderCreatedBySupervisor($workOrder)) {
                return response()->json([
                    'message' => 'WO draft harus diajukan ke supervisor terlebih dahulu.',
                ], 422);
            }
        }

        $map = [
            'draft' => 'approved',
            'pending_supervisor' => 'approved',
            'approved' => 'in_execution',
            'in_execution' => 'qc_pending',
            'qc_pending' => 'qc_approved',
            'qc_approved' => 'closed',
        ];

        $to = $request->next_status ?? ($map[$workOrder->status] ?? 'approved');

        if ($to === 'in_execution' && $workOrder->status === 'approved') {
            $workingActivities = $workOrder->mechanicActivities()
                ->where('mode', 'working')
                ->where('status', '!=', 'rejected');

            if (! $workingActivities->exists()) {
                return response()->json([
                    'message' => 'Belum ada aktivitas mekanik pada Work Order ini.',
                ], 422);
            }

            if ($workingActivities->where('status', '!=', 'approved')->exists()) {
                return response()->json([
                    'message' => 'Semua aktivitas mekanik harus disetujui sebelum Finish.',
                ], 422);
            }

            if (! WorkOrderMechanicProgress::isCrewComplete($workOrder)) {
                $summary = WorkOrderMechanicProgress::summary($workOrder);

                return response()->json([
                    'message' => "Belum semua mekanik selesai ({$summary['approved']}/{$summary['target']} manpower). "
                        .'Tunggu setiap mekanik mencatat aktivitas dan disetujui supervisor sebelum Finish.',
                ], 422);
            }
        }

        if ($request->notes) {
            $workOrder->supervisor_notes = $request->notes;
            $workOrder->save();
        }

        $this->woService->transition($workOrder, $to, $request->user(), $request->notes);
        $workOrder->refreshWorkDetails();

        $fresh = $workOrder->fresh();

        return response()->json(array_merge($fresh->toArray(), [
            'message' => $this->approveSuccessMessage($fresh, $to),
        ]));
    }

    private function approveSuccessMessage(WorkOrder $wo, string $newStatus): string
    {
        $detail = match ($newStatus) {
            'approved' => 'disetujui supervisor',
            'in_execution' => 'selesai (Finish) dan masuk tahap berikutnya',
            'qc_pending' => 'masuk QC pending',
            'qc_approved' => 'QC approved',
            'closed' => 'ditutup (closed)',
            default => 'berhasil diproses',
        };

        return "Work Order {$wo->wo_number} {$detail}.";
    }

    public function mainList(Request $request)
    {
        $query = WorkOrder::where('type', 'main');

        if ($request->boolean('for_activity')) {
            $query
                ->whereNotIn('status', self::ACTIVITY_INELIGIBLE_STATUSES)
                ->whereHas('subWorkOrders', function ($q) {
                    $q->whereNotIn('status', self::ACTIVITY_INELIGIBLE_STATUSES);
                });
        } else {
            $query->whereNotIn('status', ['closed', 'rejected']);
        }

        $list = $query
            ->select('id', 'wo_number', 'title', 'main_category', 'status')
            ->orderByDesc('id')
            ->get();

        return response()->json($list);
    }

    public function subList(Request $request)
    {
        $query = WorkOrder::where('type', 'sub')
            ->with('parent:id,wo_number,title');
        if ($request->boolean('for_activity')) {
            $query->whereNotIn('status', self::ACTIVITY_INELIGIBLE_STATUSES);
        } else {
            $query->whereNotIn('status', ['closed', 'rejected']);
        }
        $list = $query
            ->select('id', 'wo_number', 'title', 'workshop', 'status', 'parent_id')
            ->orderBy('wo_number')
            ->get();

        return response()->json($list);
    }

    private function isWorkOrderCreatedBySupervisor(WorkOrder $workOrder): bool
    {
        $creator = $workOrder->relationLoaded('creator')
            ? $workOrder->creator
            : User::find($workOrder->created_by);

        return $creator?->role === 'supervisor';
    }

    private function canManageWorkOrder(Request $request, WorkOrder $workOrder, string $action = 'edit'): bool
    {
        if (! $this->workOrderHasDraftActionPermission($request, $workOrder, $action)) {
            return false;
        }

        $user = $request->user();

        if ($user->role === 'admin' || $user->role === 'planner') {
            return in_array($workOrder->status, ['draft', 'rejected'], true);
        }

        return $workOrder->created_by === $user->id
            && in_array($workOrder->status, ['draft', 'rejected'], true);
    }

    private function workOrderHasDraftActionPermission(Request $request, WorkOrder $workOrder, string $action): bool
    {
        $user = $request->user();
        $isSub = $workOrder->type === 'sub';
        $hasGeneral = $user->hasPermission(Permission::WORK_ORDERS_UPDATE);

        if (! $isSub) {
            return $hasGeneral;
        }

        if ($action === 'delete') {
            return $hasGeneral || $user->hasPermission(Permission::WORK_ORDERS_SUB_DELETE);
        }

        return $hasGeneral || $user->hasPermission(Permission::WORK_ORDERS_SUB_EDIT);
    }

    private function canEditWorkOrder(Request $request, WorkOrder $workOrder): bool
    {
        if ($request->user()->hasPermission(Permission::WORK_ORDERS_EDIT_ANY_STATUS)) {
            return true;
        }

        return $this->canManageWorkOrder($request, $workOrder, 'edit');
    }

    private function canDeleteWorkOrder(Request $request, WorkOrder $workOrder): bool
    {
        if ($request->user()->hasPermission(Permission::WORK_ORDERS_DELETE_ANY_STATUS)) {
            return true;
        }

        return $this->canManageWorkOrder($request, $workOrder, 'delete');
    }
}
