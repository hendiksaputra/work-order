<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Models\ActivityType;
use App\Models\MechanicActivity;
use App\Models\OvertimeRequest;
use App\Models\WorkOrder;
use App\Support\Permission;
use App\Support\WorkshopSchedule;
use Illuminate\Http\Request;

class MechanicActivityController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request)
    {
        $query = MechanicActivity::with(['user', 'workOrder', 'activityType', 'approver'])
            ->latest('activity_date')
            ->latest('id');

        $viewAll = $request->user()->hasPermission(Permission::MECHANIC_ACTIVITIES_VIEW_ALL);
        $workOrderId = $request->filled('work_order_id') ? (int) $request->work_order_id : null;

        if (! $viewAll) {
            if ($workOrderId && $this->isWorkOrderEligibleForTeamActivityView($workOrderId)) {
                $query->where('work_order_id', $workOrderId);
            } else {
                $query->where('user_id', $request->user()->id);
                if ($workOrderId) {
                    $query->where('work_order_id', $workOrderId);
                }
            }
        } elseif ($workOrderId) {
            $query->where('work_order_id', $workOrderId);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    public function pendingApprovalCount()
    {
        $count = MechanicActivity::where('status', 'pending_approval')->count();

        return response()->json([
            'count' => $count,
            'label' => 'Aktivitas mekanik menunggu persetujuan supervisor',
        ]);
    }

    public function draftCount(Request $request)
    {
        $count = MechanicActivity::query()
            ->where('user_id', $request->user()->id)
            ->where('status', 'draft')
            ->count();

        return response()->json([
            'count' => $count,
            'label' => 'Aktivitas draft belum diajukan ke supervisor',
        ]);
    }

    public function store(Request $request)
    {
        if ($denied = $this->denyUnless(
            $request->user()->isMechanic() || $request->user()->role === 'admin',
            'Hanya mekanik yang dapat mencatat aktivitas kerja.'
        )) {
            return $denied;
        }

        $data = $request->validate([
            'work_order_id' => 'nullable|exists:work_orders,id',
            'activity_type_id' => 'required|exists:activity_types,id',
            'mode' => 'required|in:working,standby',
            'activity_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'notes' => 'nullable|string',
        ]);

        if ($data['mode'] === 'working' && empty($data['work_order_id'])) {
            return response()->json(['message' => 'WO wajib dipilih untuk mode Working.'], 422);
        }

        if ($data['mode'] === 'working' && $data['work_order_id']) {
            $wo = \App\Models\WorkOrder::find($data['work_order_id']);
            if ($wo && in_array($wo->status, ['closed', 'rejected', 'draft', 'pending_supervisor'], true)) {
                return response()->json([
                    'message' => 'WO harus sudah disetujui supervisor sebelum aktivitas working dicatat.',
                ], 422);
            }
        }

        if (WorkshopSchedule::exceedsStandardWorkEnd($data['end_time'])) {
            $approvedOt = OvertimeRequest::approvedForUserDate(
                $request->user()->id,
                $data['activity_date']
            );
            if (! $approvedOt) {
                return response()->json([
                    'message' => 'Jam kerja normal berakhir pukul '.WorkshopSchedule::STANDARD_WORK_END.'. Ajukan lembur ke supervisor terlebih dahulu.',
                ], 422);
            }
            if (! $approvedOt->coversEndTime($data['end_time'])) {
                return response()->json([
                    'message' => 'Jam selesai melebihi lembur yang disetujui (hingga '.substr((string) $approvedOt->overtime_end, 0, 5).').',
                ], 422);
            }
        }

        $lunchSegments = MechanicActivity::splitAroundLunchBreak(
            $data['start_time'],
            $data['end_time'],
            $data['activity_date']
        );
        $created = [];

        foreach ($lunchSegments as $segment) {
            if ($segment['type'] === 'break') {
                $created[] = MechanicActivity::create([
                    'user_id' => $request->user()->id,
                    'work_order_id' => null,
                    'activity_type_id' => $this->istirahatActivityTypeId(),
                    'mode' => 'standby',
                    'activity_date' => $data['activity_date'],
                    'start_time' => $segment['start'],
                    'end_time' => $segment['end'],
                    'notes' => 'Jam istirahat otomatis ('.WorkshopSchedule::lunchBreakLabel($data['activity_date']).')',
                    'total_hours' => MechanicActivity::calculateHours(
                        $segment['start'],
                        $segment['end'],
                        excludeLunch: false
                    ),
                    'status' => 'draft',
                ]);
                continue;
            }

            $workSegments = WorkshopSchedule::splitWorkAndOvertime($segment['start'], $segment['end']);

            foreach ($workSegments as $workSegment) {
                if ($workSegment['overtime']) {
                    $approvedOt = OvertimeRequest::approvedForUserDate(
                        $request->user()->id,
                        $data['activity_date']
                    );
                    if (! $approvedOt || ! $approvedOt->coversEndTime($workSegment['end'])) {
                        return response()->json([
                            'message' => 'Segmen lembur memerlukan persetujuan supervisor.',
                        ], 422);
                    }
                }

                $segmentNotes = $this->mergeAfternoonStartNote(
                    $data['notes'] ?? null,
                    $workSegment['start'],
                    $data['activity_date']
                );
                $segmentNotes = $this->mergeOvertimeNote($segmentNotes, $workSegment['overtime']);

                $created[] = MechanicActivity::create([
                    ...$data,
                    'user_id' => $request->user()->id,
                    'work_order_id' => $data['mode'] === 'working' ? $data['work_order_id'] : null,
                    'start_time' => $workSegment['start'],
                    'end_time' => $workSegment['end'],
                    'notes' => $segmentNotes,
                    'total_hours' => MechanicActivity::calculateHours(
                        $workSegment['start'],
                        $workSegment['end'],
                        activityDate: $data['activity_date']
                    ),
                    'status' => 'draft',
                ]);
            }
        }

        $primary = collect($created)->first(fn ($a) => $a->mode === $data['mode'])
            ?? $created[0];

        return response()->json($primary->load(['activityType', 'workOrder', 'user']), 201);
    }

    public function submit(Request $request, MechanicActivity $mechanicActivity)
    {
        if ($denied = $this->denyUnless(
            $mechanicActivity->user_id === $request->user()->id,
            'Anda hanya dapat mengajukan aktivitas milik sendiri.'
        )) {
            return $denied;
        }

        if ($mechanicActivity->status !== 'draft') {
            return response()->json(['message' => 'Hanya aktivitas draft yang dapat diajukan.'], 422);
        }

        $mechanicActivity->update(['status' => 'pending_approval']);

        return response()->json($mechanicActivity->fresh());
    }

    public function approve(Request $request, MechanicActivity $mechanicActivity)
    {
        $request->validate([
            'action' => 'required|in:approve,reject',
            'notes' => 'nullable|string',
        ]);

        if ($request->action === 'reject') {
            $mechanicActivity->update([
                'status' => 'rejected',
                'supervisor_notes' => $request->notes,
            ]);

            return response()->json($mechanicActivity->fresh());
        }

        $mechanicActivity->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'supervisor_notes' => $request->notes,
        ]);

        if ($mechanicActivity->work_order_id) {
            $mechanicActivity->workOrder?->refreshWorkDetails();
        }

        return response()->json($mechanicActivity->fresh()->load(['activityType', 'workOrder', 'user']));
    }

    public function update(Request $request, MechanicActivity $mechanicActivity)
    {
        if ($denied = $this->denyUnless(
            $this->canEditActivity($request, $mechanicActivity),
            'Anda tidak memiliki izin mengubah aktivitas ini.'
        )) {
            return $denied;
        }

        if (
            ! in_array($mechanicActivity->status, ['draft', 'rejected'], true)
            && ! $request->user()->hasPermission(Permission::MECHANIC_ACTIVITIES_EDIT_ANY_STATUS)
        ) {
            return response()->json(['message' => 'Aktivitas tidak dapat diedit pada status ini.'], 422);
        }

        $data = $request->validate([
            'work_order_id' => 'nullable|exists:work_orders,id',
            'activity_type_id' => 'required|exists:activity_types,id',
            'mode' => 'required|in:working,standby',
            'activity_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'notes' => 'nullable|string',
        ]);

        if ($data['mode'] === 'working' && empty($data['work_order_id'])) {
            return response()->json(['message' => 'WO wajib dipilih untuk mode Working.'], 422);
        }

        if ($data['mode'] === 'working' && $data['work_order_id']) {
            $wo = \App\Models\WorkOrder::find($data['work_order_id']);
            if ($wo && in_array($wo->status, ['closed', 'rejected', 'draft', 'pending_supervisor'], true)) {
                return response()->json([
                    'message' => 'WO harus sudah disetujui supervisor sebelum aktivitas working dicatat.',
                ], 422);
            }
        }

        $wasApproved = $mechanicActivity->status === 'approved';
        $workOrderId = $mechanicActivity->work_order_id;

        $mechanicActivity->update([
            ...$data,
            'work_order_id' => $data['mode'] === 'working' ? $data['work_order_id'] : null,
            'total_hours' => MechanicActivity::calculateHours(
                $data['start_time'],
                $data['end_time'],
                activityDate: $data['activity_date']
            ),
        ]);

        if ($wasApproved) {
            $mechanicActivity->workOrder?->refreshWorkDetails();
            if ($workOrderId && $workOrderId !== $mechanicActivity->work_order_id) {
                \App\Models\WorkOrder::find($workOrderId)?->refreshWorkDetails();
            }
        }

        if ($workOrderId) {
            \App\Models\WorkOrder::find($workOrderId)?->reconcileExecutionStatusFromActivities($request->user());
        }
        $mechanicActivity->workOrder?->reconcileExecutionStatusFromActivities($request->user());

        return response()->json(
            $mechanicActivity->fresh()->load(['activityType', 'workOrder', 'user'])
        );
    }

    public function destroy(Request $request, MechanicActivity $mechanicActivity)
    {
        if ($denied = $this->denyUnless(
            $this->canDeleteActivity($request, $mechanicActivity),
            'Anda tidak memiliki izin menghapus aktivitas ini.'
        )) {
            return $denied;
        }

        if (
            ! in_array($mechanicActivity->status, ['draft', 'rejected'], true)
            && ! $request->user()->hasPermission(Permission::MECHANIC_ACTIVITIES_DELETE_ANY_STATUS)
        ) {
            return response()->json(['message' => 'Hanya aktivitas draft atau ditolak yang dapat dihapus.'], 422);
        }

        $wasApproved = $mechanicActivity->status === 'approved';
        $workOrderId = $mechanicActivity->work_order_id;

        $mechanicActivity->delete();

        if ($workOrderId) {
            $workOrder = \App\Models\WorkOrder::find($workOrderId);
            if ($workOrder) {
                $workOrder->reconcileExecutionStatusFromActivities($request->user());
                if ($wasApproved) {
                    $workOrder->refreshWorkDetails();
                }
            }
        }

        return response()->json(['message' => 'Aktivitas dihapus.']);
    }

    public function activityTypes()
    {
        return response()->json(
            ActivityType::where('is_active', true)->orderBy('category')->orderBy('name')->get()
        );
    }

    private function istirahatActivityTypeId(): int
    {
        return ActivityType::firstOrCreate(
            ['name' => 'Istirahat'],
            ['category' => 'non_productive', 'is_active' => true]
        )->id;
    }

    private function mergeAfternoonStartNote(?string $notes, string $startTime, string $activityDate): ?string
    {
        $lunchEnd = WorkshopSchedule::lunchEndForDate($activityDate);
        if (WorkshopSchedule::timeToMinutes($startTime) < WorkshopSchedule::timeToMinutes($lunchEnd)) {
            return $notes;
        }

        $delay = WorkshopSchedule::timeToMinutes($startTime) - WorkshopSchedule::timeToMinutes($lunchEnd);
        $auto = "Mulai siang aktual {$startTime} (jadwal istirahat selesai {$lunchEnd})";
        if ($delay > 0) {
            $auto .= " (+{$delay} menit)";
        }

        return $notes ? "{$notes} | {$auto}" : $auto;
    }

    private function mergeOvertimeNote(?string $notes, bool $isOvertime): ?string
    {
        if (! $isOvertime) {
            return $notes;
        }

        $auto = 'Lembur (disetujui supervisor)';

        return $notes ? "{$notes} | {$auto}" : $auto;
    }

    /** Sub WO yang sudah disetujui — mekanik boleh lihat aktivitas tim pada WO yang sama. */
    private function isWorkOrderEligibleForTeamActivityView(int $workOrderId): bool
    {
        $wo = WorkOrder::find($workOrderId);

        if (! $wo || $wo->type !== 'sub') {
            return false;
        }

        return ! in_array($wo->status, ['closed', 'rejected', 'draft', 'pending_supervisor'], true);
    }

    private function canManageActivity(Request $request, MechanicActivity $mechanicActivity): bool
    {
        $user = $request->user();

        if (! $user->hasPermission(Permission::MECHANIC_ACTIVITIES_UPDATE)) {
            return false;
        }

        return $mechanicActivity->user_id === $user->id
            && in_array($mechanicActivity->status, ['draft', 'rejected'], true);
    }

    private function canEditActivity(Request $request, MechanicActivity $mechanicActivity): bool
    {
        if ($request->user()->hasPermission(Permission::MECHANIC_ACTIVITIES_EDIT_ANY_STATUS)) {
            return true;
        }

        return $this->canManageActivity($request, $mechanicActivity);
    }

    private function canDeleteActivity(Request $request, MechanicActivity $mechanicActivity): bool
    {
        if ($request->user()->hasPermission(Permission::MECHANIC_ACTIVITIES_DELETE_ANY_STATUS)) {
            return true;
        }

        if (! $request->user()->hasPermission(Permission::MECHANIC_ACTIVITIES_DELETE)) {
            return false;
        }

        return $mechanicActivity->user_id === $request->user()->id
            && in_array($mechanicActivity->status, ['draft', 'rejected'], true);
    }
}
