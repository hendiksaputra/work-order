<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Models\PartsRequest;
use App\Models\User;
use App\Support\Permission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PartsRequestController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request)
    {
        $viewer = $request->user();

        $query = PartsRequest::with([
            'workOrder.subWorkOrders:id,parent_id,workshop,type',
            'creator',
            'items',
        ])->latest();

        if ($viewer->role === 'mechanic') {
            $query->where('created_by', $viewer->id);
        } elseif ($this->shouldScopePartsByWorkOrder($viewer)) {
            $this->applyWorkOrderScope($query, $viewer);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->paginate($request->integer('per_page', 15)));
    }

    public function pendingApprovalCount(Request $request)
    {
        $viewer = $request->user();

        if (
            ! $viewer->canViewAllDepartments()
            && ! $viewer->hasPermission(Permission::PARTS_SUPERVISOR)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($viewer->canViewAllDepartments()) {
            return response()->json($this->pendingApprovalSummaryForPlanner());
        }

        $query = PartsRequest::query()->where('status', 'pending_approval');
        $this->applyWorkOrderScope($query, $viewer);

        return response()->json([
            'count' => $query->count(),
            'label' => 'Parts request menunggu persetujuan supervisor',
        ]);
    }

    /**
     * @return array{count: int, label: string, by_department: list<array{department: string, workshop: string, count: int, supervisors: list<string>}>}
     */
    private function pendingApprovalSummaryForPlanner(): array
    {
        $pending = PartsRequest::query()
            ->where('status', 'pending_approval')
            ->with(['workOrder.subWorkOrders:id,parent_id,workshop,type'])
            ->get();

        $byWorkshop = [];
        foreach ($pending as $partsRequest) {
            $workshop = $this->resolveApprovalWorkshop($partsRequest);
            $byWorkshop[$workshop] = ($byWorkshop[$workshop] ?? 0) + 1;
        }

        $supervisorsByDepartment = User::query()
            ->where('role', 'supervisor')
            ->where('is_active', true)
            ->whereNotNull('department')
            ->where('department', '!=', '')
            ->orderBy('department')
            ->orderBy('name')
            ->get(['name', 'department'])
            ->groupBy(fn (User $user) => strtolower(trim($user->department ?? '')));

        $breakdown = [];
        $seenWorkshops = [];

        foreach ($supervisorsByDepartment as $workshop => $supervisors) {
            $count = $byWorkshop[$workshop] ?? 0;
            if ($count <= 0) {
                continue;
            }

            $department = strtoupper(trim((string) $supervisors->first()->department));
            $breakdown[] = [
                'department' => $department,
                'workshop' => $workshop,
                'count' => $count,
                'supervisors' => $supervisors->pluck('name')->values()->all(),
            ];
            $seenWorkshops[] = $workshop;
        }

        foreach ($byWorkshop as $workshop => $count) {
            if ($count <= 0 || in_array($workshop, $seenWorkshops, true)) {
                continue;
            }

            $breakdown[] = [
                'department' => strtoupper($workshop),
                'workshop' => $workshop,
                'count' => $count,
                'supervisors' => [],
            ];
        }

        usort($breakdown, fn (array $a, array $b) => $b['count'] <=> $a['count']);

        return [
            'count' => $pending->count(),
            'label' => 'Parts request menunggu persetujuan supervisor',
            'by_department' => $breakdown,
        ];
    }

    private function resolveApprovalWorkshop(PartsRequest $partsRequest): string
    {
        $workOrder = $partsRequest->workOrder;
        if (! $workOrder) {
            return strtolower(trim((string) ($partsRequest->workshop ?? 'unknown')));
        }

        $workshop = trim((string) ($workOrder->workshop ?? ''));
        if ($workshop !== '') {
            return strtolower($workshop);
        }

        if ($workOrder->type === 'main') {
            $subWorkshops = $workOrder->subWorkOrders
                ->pluck('workshop')
                ->map(fn ($value) => strtolower(trim((string) $value)))
                ->filter(fn (string $value) => $value !== '')
                ->unique()
                ->values();

            if ($subWorkshops->count() === 1) {
                return $subWorkshops->first();
            }
        }

        return strtolower(trim((string) ($partsRequest->workshop ?? 'unknown')));
    }

    public function show(Request $request, PartsRequest $partsRequest)
    {
        if ($denied = $this->denyUnless(
            $this->canViewPartsRequest($request, $partsRequest),
            'Anda tidak dapat melihat permintaan parts ini.'
        )) {
            return $denied;
        }

        $partsRequest->load(['workOrder', 'creator', 'items', 'approver', 'logisticUser']);

        return response()->json($partsRequest);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'workshop' => 'required|in:rebuild,fabrication,support',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.part_name' => 'required|string|max:255',
            'items.*.part_number' => 'nullable|string|max:255',
            'items.*.qty' => 'required|numeric|min:0.01',
            'items.*.unit' => 'nullable|string|max:50',
            'items.*.in_stock' => 'boolean',
            'items.*.unit_cost' => 'nullable|numeric|min:0',
            'items.*.notes' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($data, $request) {
            $seq = PartsRequest::count() + 1;
            $pr = PartsRequest::create([
                'request_number' => 'PR-'.str_pad((string) $seq, 5, '0', STR_PAD_LEFT),
                'work_order_id' => $data['work_order_id'],
                'workshop' => $data['workshop'],
                'notes' => $data['notes'] ?? null,
                'status' => 'draft',
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['items'] as $item) {
                $pr->items()->create([
                    'part_name' => $item['part_name'],
                    'part_number' => $item['part_number'] ?? null,
                    'qty' => $item['qty'],
                    'unit' => $item['unit'] ?? 'pcs',
                    'in_stock' => $item['in_stock'] ?? true,
                    'is_outstanding' => ! ($item['in_stock'] ?? true),
                    'unit_cost' => $item['unit_cost'] ?? 0,
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            return response()->json($pr->load(['items', 'workOrder']), 201);
        });
    }

    public function submit(Request $request, PartsRequest $partsRequest)
    {
        if ($denied = $this->denyUnless(
            $this->canSubmitPartsRequest($request, $partsRequest),
            'Anda tidak dapat mengajukan permintaan parts ini.'
        )) {
            return $denied;
        }

        if (! in_array($partsRequest->status, ['draft', 'rejected'], true)) {
            return response()->json([
                'message' => 'Hanya request berstatus draft atau ditolak yang dapat diajukan.',
            ], 422);
        }

        $partsRequest->update(['status' => 'pending_approval']);

        return response()->json($partsRequest->fresh());
    }

    public function supervisorAction(Request $request, PartsRequest $partsRequest)
    {
        $request->validate(['action' => 'required|in:approve,reject', 'notes' => 'nullable|string']);

        if ($partsRequest->status !== 'pending_approval') {
            return response()->json(['message' => 'Hanya request pending yang dapat diproses supervisor.'], 422);
        }

        if ($denied = $this->denyUnless(
            $this->canSupervisorApprovePartsRequest($request->user(), $partsRequest),
            'Anda tidak dapat memproses parts request untuk lokasi/workshop WO ini.'
        )) {
            return $denied;
        }

        if ($request->action === 'reject') {
            $partsRequest->update(['status' => 'rejected', 'supervisor_notes' => $request->notes]);

            return response()->json($partsRequest->fresh());
        }

        $partsRequest->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'supervisor_notes' => $request->notes,
        ]);

        $partsRequest->workOrder?->refreshWorkDetails();

        return response()->json($partsRequest->fresh()->load('items'));
    }

    public function logisticAction(Request $request, PartsRequest $partsRequest)
    {
        $request->validate(['action' => 'required|in:check,taken']);

        if ($request->user()->role !== 'logistic') {
            return response()->json([
                'message' => 'Hanya role logistic yang dapat memproses parts request.',
            ], 403);
        }

        if (! in_array($partsRequest->status, ['approved', 'logistic_check'], true)) {
            return response()->json([
                'message' => 'Logistic hanya dapat memproses request yang sudah disetujui supervisor.',
            ], 422);
        }

        $status = $request->action === 'taken' ? 'taken' : 'logistic_check';
        $partsRequest->update([
            'status' => $status,
            'logistic_by' => $request->user()->id,
        ]);

        if ($status === 'taken') {
            $partsRequest->workOrder?->refreshWorkDetails();
        }

        return response()->json($partsRequest->fresh()->load('items'));
    }

    public function update(Request $request, PartsRequest $partsRequest)
    {
        if ($denied = $this->denyUnless(
            $this->canEditPartsRequest($request, $partsRequest),
            'Anda tidak memiliki izin mengubah permintaan parts ini.'
        )) {
            return $denied;
        }

        if (
            ! in_array($partsRequest->status, ['draft', 'rejected'], true)
            && ! $request->user()->hasPermission(Permission::PARTS_EDIT_ANY_STATUS)
        ) {
            return response()->json(['message' => 'Parts request tidak dapat diedit pada status ini.'], 422);
        }

        $data = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'workshop' => 'required|in:rebuild,fabrication,support',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.part_name' => 'required|string|max:255',
            'items.*.part_number' => 'nullable|string|max:255',
            'items.*.qty' => 'required|numeric|min:0.01',
            'items.*.unit' => 'nullable|string|max:50',
            'items.*.in_stock' => 'boolean',
            'items.*.unit_cost' => 'nullable|numeric|min:0',
            'items.*.notes' => 'nullable|string',
        ]);

        $previousWorkOrderId = $partsRequest->work_order_id;
        $affectedWo = $this->statusAffectsWorkOrder($partsRequest->status);

        return DB::transaction(function () use ($data, $partsRequest, $previousWorkOrderId, $affectedWo) {
            $partsRequest->update([
                'work_order_id' => $data['work_order_id'],
                'workshop' => $data['workshop'],
                'notes' => $data['notes'] ?? null,
            ]);

            $partsRequest->items()->delete();

            foreach ($data['items'] as $item) {
                $partsRequest->items()->create([
                    'part_name' => $item['part_name'],
                    'part_number' => $item['part_number'] ?? null,
                    'qty' => $item['qty'],
                    'unit' => $item['unit'] ?? 'pcs',
                    'in_stock' => $item['in_stock'] ?? true,
                    'is_outstanding' => ! ($item['in_stock'] ?? true),
                    'unit_cost' => $item['unit_cost'] ?? 0,
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            if ($affectedWo) {
                $partsRequest->workOrder?->refreshWorkDetails();
                if ($previousWorkOrderId && $previousWorkOrderId !== $partsRequest->work_order_id) {
                    \App\Models\WorkOrder::find($previousWorkOrderId)?->refreshWorkDetails();
                }
            }

            return response()->json($partsRequest->fresh()->load(['items', 'workOrder']));
        });
    }

    public function destroy(Request $request, PartsRequest $partsRequest)
    {
        if ($denied = $this->denyUnless(
            $this->canDeletePartsRequest($request, $partsRequest),
            'Anda tidak memiliki izin menghapus permintaan parts ini.'
        )) {
            return $denied;
        }

        if (
            ! in_array($partsRequest->status, ['draft', 'rejected'], true)
            && ! $request->user()->hasPermission(Permission::PARTS_DELETE_ANY_STATUS)
        ) {
            return response()->json(['message' => 'Hanya parts request draft atau ditolak yang dapat dihapus.'], 422);
        }

        $workOrderId = $partsRequest->work_order_id;
        $affectedWo = $this->statusAffectsWorkOrder($partsRequest->status);

        $partsRequest->items()->delete();
        $partsRequest->delete();

        if ($affectedWo && $workOrderId) {
            \App\Models\WorkOrder::find($workOrderId)?->refreshWorkDetails();
        }

        return response()->json(['message' => 'Parts request dihapus.']);
    }

    private function statusAffectsWorkOrder(string $status): bool
    {
        return in_array($status, ['approved', 'logistic_check', 'taken'], true);
    }

    private function canManagePartsRequest(Request $request, PartsRequest $partsRequest): bool
    {
        $user = $request->user();

        if (! $user->hasPermission(Permission::PARTS_UPDATE)) {
            return false;
        }

        return $partsRequest->created_by === $user->id
            && in_array($partsRequest->status, ['draft', 'rejected'], true);
    }

    private function canEditPartsRequest(Request $request, PartsRequest $partsRequest): bool
    {
        if ($request->user()->hasPermission(Permission::PARTS_EDIT_ANY_STATUS)) {
            return true;
        }

        return $this->canManagePartsRequest($request, $partsRequest);
    }

    private function canDeletePartsRequest(Request $request, PartsRequest $partsRequest): bool
    {
        if ($request->user()->hasPermission(Permission::PARTS_DELETE_ANY_STATUS)) {
            return true;
        }

        if (! $request->user()->hasPermission(Permission::PARTS_DELETE)) {
            return false;
        }

        return $partsRequest->created_by === $request->user()->id
            && in_array($partsRequest->status, ['draft', 'rejected'], true);
    }

    private function canViewPartsRequest(Request $request, PartsRequest $partsRequest): bool
    {
        $user = $request->user();

        if ($user->canViewAllDepartments()) {
            return true;
        }

        if ($user->role === 'logistic') {
            return true;
        }

        if ($user->role === 'mechanic') {
            return $partsRequest->created_by === $user->id;
        }

        if ($user->role === 'supervisor') {
            $partsRequest->loadMissing('workOrder');

            return $partsRequest->workOrder?->isVisibleTo($user) ?? false;
        }

        return $partsRequest->created_by === $user->id;
    }

    private function shouldScopePartsByWorkOrder(User $user): bool
    {
        if ($user->canViewAllDepartments() || $user->role === 'logistic') {
            return false;
        }

        return $user->role === 'supervisor'
            && $user->hasPermission(Permission::PARTS_SUPERVISOR);
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<PartsRequest>  $query
     */
    private function applyWorkOrderScope($query, User $viewer): void
    {
        if ($viewer->canViewAllDepartments()) {
            return;
        }

        $query->whereHas('workOrder', function ($woQuery) use ($viewer) {
            $woQuery->visibleTo($viewer);
        });
    }

    private function canSupervisorApprovePartsRequest(User $supervisor, PartsRequest $partsRequest): bool
    {
        if (! $supervisor->hasPermission(Permission::PARTS_SUPERVISOR)) {
            return false;
        }

        if ($supervisor->canViewAllDepartments()) {
            return true;
        }

        $partsRequest->loadMissing('workOrder');

        return $partsRequest->workOrder?->isVisibleTo($supervisor) ?? false;
    }

    private function canSubmitPartsRequest(Request $request, PartsRequest $partsRequest): bool
    {
        $user = $request->user();

        if ($user->role === 'admin' || $user->role === 'planner') {
            return true;
        }

        return $partsRequest->created_by === $user->id;
    }
}
