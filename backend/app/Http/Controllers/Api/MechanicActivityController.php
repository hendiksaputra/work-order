<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Models\ActivityType;
use App\Models\MechanicActivity;
use App\Models\MechanicActivitySubmission;
use App\Models\OvertimeRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Support\Permission;
use App\Support\WorkshopSchedule;
use Illuminate\Http\Request;

class MechanicActivityController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request)
    {
        $query = MechanicActivity::with(['user', 'workOrder', 'activityType', 'approver', 'submission'])
            ->latest('activity_date')
            ->latest('id');

        $viewAll = $request->user()->hasPermission(Permission::MECHANIC_ACTIVITIES_VIEW_ALL);
        $workOrderId = $request->filled('work_order_id') ? (int) $request->work_order_id : null;

        if (! $viewAll) {
            if ($workOrderId && $this->isWorkOrderEligibleForTeamActivityView($workOrderId, $request->user())) {
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

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->trim();
            if ($search !== '') {
                $query->whereHas('user', function ($userQuery) use ($search) {
                    $userQuery->where(function ($inner) use ($search) {
                        $inner->where('name', 'like', "%{$search}%")
                            ->orWhere('username', 'like', "%{$search}%")
                            ->orWhere('employee_id', 'like', "%{$search}%");
                    });
                });
            }
        }

        if ($request->filled('activity_date')) {
            $query->whereDate('activity_date', $request->activity_date);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('activity_date', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('activity_date', '<=', $request->date('date_to'));
        }

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    public function filterMechanics(Request $request)
    {
        $query = User::query()
            ->where('role', 'mechanic')
            ->where('is_active', true)
            ->orderBy('name');

        if (! $request->user()->canViewAllDepartments()) {
            $query->visibleTo($request->user());
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->trim();
            if ($search !== '') {
                $query->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%")
                        ->orWhere('employee_id', 'like', "%{$search}%");
                });
            }
        }

        return response()->json(
            $query->get(['id', 'name', 'employee_id', 'department'])
        );
    }

    public function pendingApprovalCount(Request $request)
    {
        return app(MechanicActivitySubmissionController::class)->pendingApprovalCount($request);
    }

    public function draftCount(Request $request)
    {
        return app(MechanicActivitySubmissionController::class)->draftDayCount($request);
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
            if ($denied = $this->denyUnlessWorkingWorkOrderEligible($request, (int) $data['work_order_id'])) {
                return $denied;
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

        foreach ($created as $activity) {
            MechanicActivitySubmissionController::attachActivity($activity);
        }

        return response()->json($primary->load(['activityType', 'workOrder', 'user', 'submission']), 201);
    }

    public function submit(Request $request, MechanicActivity $mechanicActivity)
    {
        if ($denied = $this->denyUnless(
            $mechanicActivity->user_id === $request->user()->id,
            'Anda hanya dapat mengajukan aktivitas milik sendiri.'
        )) {
            return $denied;
        }

        $submission = $this->resolveSubmissionForActivity($mechanicActivity);

        return app(MechanicActivitySubmissionController::class)->submitOne($request, $submission);
    }

    public function bulkSubmit(Request $request)
    {
        return app(MechanicActivitySubmissionController::class)->bulkSubmit($request);
    }

    public function approve(Request $request, MechanicActivity $mechanicActivity)
    {
        $request->validate([
            'action' => 'required|in:approve,reject',
            'notes' => 'required_if:action,reject|nullable|string|min:3|max:2000',
        ]);

        if ($mechanicActivity->status !== 'pending_approval') {
            return response()->json(['message' => 'Hanya aktivitas menunggu persetujuan yang dapat diproses.'], 422);
        }

        if (! $this->canSupervisorApproveActivity($request->user(), $mechanicActivity)) {
            return response()->json(['message' => 'Aktivitas tidak ditemukan.'], 404);
        }

        $submission = $this->resolveSubmissionForActivity($mechanicActivity);

        $this->applyActivityApprovalDecision(
            $mechanicActivity,
            $request->action,
            $request->user(),
            $request->notes
        );

        if ($request->action === 'approve' && $mechanicActivity->work_order_id) {
            WorkOrder::find($mechanicActivity->work_order_id)?->refreshWorkDetails();
        }

        $submission->refreshTotals();
        $submission->syncStatusFromActivities($request->user()->id);

        if ($submission->fresh()->status === 'approved' && ! $submission->approved_by) {
            $submission->update([
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);
        }

        return response()->json(
            $mechanicActivity->fresh()->load(['activityType', 'workOrder', 'user', 'submission'])
        );
    }

    public function bulkApprove(Request $request)
    {
        return app(MechanicActivitySubmissionController::class)->bulkApprove($request);
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
            if ($denied = $this->denyUnlessWorkingWorkOrderEligible($request, (int) $data['work_order_id'])) {
                return $denied;
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
        $submission = $mechanicActivity->submission;

        $mechanicActivity->delete();

        if ($submission) {
            if ($submission->activities()->count() === 0) {
                $submission->delete();
            } else {
                $submission->refreshTotals();
            }
        }

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

    private function resolveSubmissionForActivity(MechanicActivity $activity): MechanicActivitySubmission
    {
        if ($activity->submission_id) {
            return $activity->submission ?? MechanicActivitySubmission::findOrFail($activity->submission_id);
        }

        $submission = MechanicActivitySubmission::firstOrCreate(
            [
                'user_id' => $activity->user_id,
                'activity_date' => $activity->activity_date,
            ],
            ['status' => $activity->status === 'pending_approval' ? 'pending_approval' : 'draft']
        );

        $activity->update(['submission_id' => $submission->id]);
        $submission->refreshTotals();

        return $submission->fresh();
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
    private function isWorkOrderEligibleForTeamActivityView(int $workOrderId, User $viewer): bool
    {
        $wo = WorkOrder::find($workOrderId);

        if (! $wo || $wo->type !== 'sub') {
            return false;
        }

        if (! $wo->isVisibleTo($viewer)) {
            return false;
        }

        return ! in_array($wo->status, WorkOrder::ACTIVITY_INELIGIBLE_STATUSES, true);
    }

    private function denyUnlessWorkingWorkOrderEligible(Request $request, int $workOrderId)
    {
        $wo = WorkOrder::find($workOrderId);

        if (! $wo) {
            return response()->json(['message' => 'Work Order tidak ditemukan.'], 404);
        }

        if (! $wo->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Work Order tidak ditemukan.'], 404);
        }

        if (in_array($wo->status, WorkOrder::ACTIVITY_INELIGIBLE_STATUSES, true)) {
            return response()->json([
                'message' => 'Sub WO harus sudah disetujui supervisor sebelum aktivitas working dicatat.',
            ], 422);
        }

        return null;
    }

    private function canSupervisorApproveActivity(User $supervisor, MechanicActivity $activity): bool
    {
        if ($supervisor->canViewAllDepartments()) {
            return true;
        }

        if (! $activity->work_order_id) {
            return true;
        }

        $workOrder = $activity->relationLoaded('workOrder')
            ? $activity->workOrder
            : WorkOrder::find($activity->work_order_id);

        return $workOrder?->isVisibleTo($supervisor) ?? false;
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<MechanicActivity>  $query
     */
    private function applyApprovalLocationScope($query, User $viewer): void
    {
        if ($viewer->canViewAllDepartments()) {
            return;
        }

        $department = trim((string) ($viewer->department ?? ''));

        $query->where(function ($outer) use ($department) {
            $outer->whereNull('work_order_id')
                ->orWhereHas('workOrder', function ($workOrderQuery) use ($department) {
                    if ($department === '') {
                        $workOrderQuery->where(function ($inner) {
                            $inner->whereNull('workshop')->orWhere('workshop', '');
                        });

                        return;
                    }

                    $workOrderQuery->whereRaw('LOWER(workshop) = ?', [strtolower($department)]);
                });
        });
    }

    private function applyActivityApprovalDecision(
        MechanicActivity $activity,
        string $action,
        User $approver,
        ?string $notes
    ): void {
        if ($action === 'reject') {
            $activity->update([
                'status' => 'rejected',
                'supervisor_notes' => $notes,
                'approved_by' => null,
                'approved_at' => null,
            ]);

            return;
        }

        $activity->update([
            'status' => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
            'supervisor_notes' => $notes,
        ]);
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
