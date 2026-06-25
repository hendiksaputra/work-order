<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Models\PartsRequest;
use App\Support\Permission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PartsRequestController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request)
    {
        $query = PartsRequest::with(['workOrder', 'creator', 'items'])
            ->latest();

        if ($request->user()->role === 'mechanic') {
            $query->where('created_by', $request->user()->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->paginate($request->integer('per_page', 15)));
    }

    public function pendingApprovalCount()
    {
        $count = PartsRequest::where('status', 'pending_approval')->count();

        return response()->json([
            'count' => $count,
            'label' => 'Parts request menunggu persetujuan supervisor',
        ]);
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

        if (in_array($user->role, ['admin', 'supervisor', 'planner', 'logistic'], true)) {
            return true;
        }

        return $partsRequest->created_by === $user->id;
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
