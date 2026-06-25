<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Models\OvertimeRequest;
use App\Support\Permission;
use App\Support\WorkshopSchedule;
use Illuminate\Http\Request;

class OvertimeRequestController extends Controller
{
    use AuthorizesRequests;

    public function status(Request $request)
    {
        $data = $request->validate([
            'activity_date' => 'required|date',
        ]);

        $userId = $request->user()->id;
        if ($request->user()->hasPermission(Permission::MECHANIC_ACTIVITIES_VIEW_ALL)
            && $request->filled('user_id')) {
            $userId = (int) $request->user_id;
        }

        $pending = OvertimeRequest::query()
            ->where('user_id', $userId)
            ->whereDate('activity_date', $data['activity_date'])
            ->where('status', 'pending_approval')
            ->latest('id')
            ->first();

        $approved = OvertimeRequest::approvedForUserDate($userId, $data['activity_date']);

        return response()->json([
            'standard_work_end' => WorkshopSchedule::STANDARD_WORK_END,
            'has_pending' => $pending !== null,
            'pending' => $pending?->load(['workOrder', 'user']),
            'has_approved' => $approved !== null,
            'approved' => $approved?->load(['workOrder', 'user', 'approver']),
            'approved_until' => $approved
                ? substr((string) $approved->overtime_end, 0, 5)
                : null,
        ]);
    }

    public function index(Request $request)
    {
        $query = OvertimeRequest::with(['user', 'workOrder', 'approver'])
            ->latest('activity_date')
            ->latest('id');

        if (! $request->user()->hasPermission(Permission::MECHANIC_ACTIVITIES_VIEW_ALL)) {
            $query->where('user_id', $request->user()->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('activity_date')) {
            $query->whereDate('activity_date', $request->activity_date);
        }

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    public function pendingApprovalCount()
    {
        $count = OvertimeRequest::where('status', 'pending_approval')->count();

        return response()->json([
            'count' => $count,
            'label' => 'Pengajuan lembur menunggu persetujuan supervisor',
        ]);
    }

    public function store(Request $request)
    {
        if ($denied = $this->denyUnless(
            $request->user()->isMechanic() || $request->user()->role === 'admin',
            'Hanya mekanik yang dapat mengajukan lembur.'
        )) {
            return $denied;
        }

        $data = $request->validate([
            'activity_date' => 'required|date',
            'work_order_id' => 'nullable|exists:work_orders,id',
            'overtime_end' => 'required|date_format:H:i',
            'reason' => 'required|string|min:5|max:500',
        ]);

        if (WorkshopSchedule::timeToMinutes($data['overtime_end']) <= WorkshopSchedule::timeToMinutes(WorkshopSchedule::STANDARD_WORK_END)) {
            return response()->json([
                'message' => 'Jam selesai lembur harus setelah '.WorkshopSchedule::STANDARD_WORK_END.'.',
            ], 422);
        }

        $existingPending = OvertimeRequest::query()
            ->where('user_id', $request->user()->id)
            ->whereDate('activity_date', $data['activity_date'])
            ->where('status', 'pending_approval')
            ->exists();

        if ($existingPending) {
            return response()->json([
                'message' => 'Sudah ada pengajuan lembur yang menunggu persetujuan untuk tanggal ini.',
            ], 422);
        }

        $ot = OvertimeRequest::create([
            'user_id' => $request->user()->id,
            'work_order_id' => $data['work_order_id'] ?? null,
            'activity_date' => $data['activity_date'],
            'overtime_start' => WorkshopSchedule::STANDARD_WORK_END,
            'overtime_end' => $data['overtime_end'],
            'reason' => $data['reason'],
            'status' => 'pending_approval',
        ]);

        return response()->json($ot->load(['workOrder', 'user']), 201);
    }

    public function approve(Request $request, OvertimeRequest $overtimeRequest)
    {
        $request->validate([
            'action' => 'required|in:approve,reject',
            'notes' => 'nullable|string',
        ]);

        if ($overtimeRequest->status !== 'pending_approval') {
            return response()->json(['message' => 'Hanya pengajuan pending yang dapat diproses.'], 422);
        }

        if ($request->action === 'reject') {
            $overtimeRequest->update([
                'status' => 'rejected',
                'supervisor_notes' => $request->notes,
            ]);

            return response()->json($overtimeRequest->fresh()->load(['user', 'workOrder']));
        }

        $overtimeRequest->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'supervisor_notes' => $request->notes,
        ]);

        return response()->json($overtimeRequest->fresh()->load(['user', 'workOrder', 'approver']));
    }
}
