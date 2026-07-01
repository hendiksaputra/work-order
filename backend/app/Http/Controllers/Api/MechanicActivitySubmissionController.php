<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Models\MechanicActivity;
use App\Models\MechanicActivitySubmission;
use App\Models\User;
use App\Models\WorkOrder;
use App\Support\Permission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MechanicActivitySubmissionController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request)
    {
        $viewer = $request->user();
        $viewAll = $viewer->hasPermission(Permission::MECHANIC_ACTIVITIES_VIEW_ALL);

        $query = MechanicActivitySubmission::query()
            ->with([
                'user',
                'approver',
                'activities' => fn ($activityQuery) => $activityQuery->with($this->activityRelationLoads()),
            ])
            ->withCount('activities')
            ->latest('activity_date')
            ->latest('id');

        if (! $viewAll) {
            $query->where('user_id', $viewer->id);
        } else {
            $this->applySupervisorUserScope($query, $viewer);
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

        if ($request->filled('date_from')) {
            $query->whereDate('activity_date', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('activity_date', '<=', $request->date('date_to'));
        }

        if ($request->filled('work_order_id')) {
            $workOrderId = $request->integer('work_order_id');
            $query->whereHas('activities', fn ($activityQuery) => $activityQuery->where('work_order_id', $workOrderId));
        }

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    public function pendingApprovalCount(Request $request)
    {
        $query = MechanicActivitySubmission::query()->where('status', 'pending_approval');
        $this->applySupervisorUserScope($query, $request->user());

        if ($request->filled('work_order_id')) {
            $workOrderId = $request->integer('work_order_id');
            $query->whereHas('activities', fn ($activityQuery) => $activityQuery->where('work_order_id', $workOrderId));
        }

        return response()->json([
            'count' => $query->count(),
            'label' => 'Laporan harian aktivitas mekanik menunggu persetujuan supervisor',
        ]);
    }

    public function draftDayCount(Request $request)
    {
        $count = MechanicActivitySubmission::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['draft', 'rejected'])
            ->whereHas('activities', fn ($q) => $q->where('status', 'draft'))
            ->count();

        return response()->json([
            'count' => $count,
            'label' => 'Hari kerja dengan aktivitas draft belum diajukan',
        ]);
    }

    public function bulkSubmit(Request $request)
    {
        $request->validate([
            'activity_date' => 'sometimes|date',
        ]);

        $query = MechanicActivitySubmission::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['draft', 'rejected'])
            ->whereHas('activities', fn ($q) => $q->whereIn('status', ['draft', 'rejected']));

        if ($request->filled('activity_date')) {
            $query->whereDate('activity_date', $request->date('activity_date'));
        }

        $submissions = $query->orderBy('activity_date')->get();

        if ($submissions->isEmpty()) {
            return response()->json(['message' => 'Tidak ada laporan harian draft untuk diajukan.'], 422);
        }

        $submittedDays = 0;
        $submittedActivities = 0;

        DB::transaction(function () use ($submissions, &$submittedDays, &$submittedActivities) {
            foreach ($submissions as $submission) {
                $count = $this->submitSubmission($submission);
                if ($count > 0) {
                    $submittedDays++;
                    $submittedActivities += $count;
                }
            }
        });

        if ($submittedDays === 0) {
            return response()->json(['message' => 'Tidak ada aktivitas draft untuk diajukan.'], 422);
        }

        return response()->json([
            'message' => "{$submittedDays} laporan harian ({$submittedActivities} aktivitas) berhasil diajukan ke supervisor.",
            'submitted_days' => $submittedDays,
            'submitted_activities' => $submittedActivities,
        ]);
    }

    public function submitOne(Request $request, MechanicActivitySubmission $mechanicActivitySubmission)
    {
        if ($mechanicActivitySubmission->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Anda hanya dapat mengajukan laporan harian milik sendiri.'], 403);
        }

        $count = $this->submitSubmission($mechanicActivitySubmission);

        if ($count === 0) {
            return response()->json(['message' => 'Tidak ada aktivitas draft pada hari ini.'], 422);
        }

        return response()->json([
            'message' => "Laporan harian {$mechanicActivitySubmission->activity_date->format('d/m/Y')} ({$count} aktivitas) berhasil diajukan ke supervisor.",
            'submission' => $mechanicActivitySubmission->fresh()->load([
                'activities' => fn ($activityQuery) => $activityQuery->with($this->activityRelationLoads()),
                'user',
            ]),
        ]);
    }

    public function approve(Request $request, MechanicActivitySubmission $mechanicActivitySubmission)
    {
        $request->validate([
            'action' => 'required|in:approve,reject',
            'notes' => 'required_if:action,reject|nullable|string|min:3|max:2000',
        ]);

        if ($mechanicActivitySubmission->status !== 'pending_approval') {
            return response()->json(['message' => 'Hanya laporan harian menunggu persetujuan yang dapat diproses.'], 422);
        }

        if (! $this->canSupervisorApproveSubmission($request->user(), $mechanicActivitySubmission)) {
            return response()->json(['message' => 'Laporan harian tidak ditemukan.'], 404);
        }

        $this->applySubmissionDecision(
            $mechanicActivitySubmission,
            $request->action,
            $request->user(),
            $request->notes
        );

        return response()->json(
            $mechanicActivitySubmission->fresh()->load([
                'user',
                'approver',
                'activities' => fn ($activityQuery) => $activityQuery->with($this->activityRelationLoads()),
            ])
        );
    }

    public function bulkApprove(Request $request)
    {
        $data = $request->validate([
            'action' => 'required|in:approve,reject',
            'notes' => 'required_if:action,reject|nullable|string|min:3|max:2000',
            'ids' => 'sometimes|array',
            'ids.*' => 'integer|exists:mechanic_activity_submissions,id',
            'work_order_id' => 'sometimes|integer|exists:work_orders,id',
            'user_id' => 'sometimes|integer|exists:users,id',
        ]);

        $query = MechanicActivitySubmission::query()->where('status', 'pending_approval');
        $this->applySupervisorUserScope($query, $request->user());

        if (! empty($data['ids'])) {
            $query->whereIn('id', $data['ids']);
        }
        if (! empty($data['user_id'])) {
            $query->where('user_id', $data['user_id']);
        }
        if (! empty($data['work_order_id'])) {
            $query->whereHas('activities', fn ($q) => $q->where('work_order_id', $data['work_order_id']));
        }

        $submissions = $query->orderBy('activity_date')->get();

        if ($submissions->isEmpty()) {
            return response()->json(['message' => 'Tidak ada laporan harian yang menunggu persetujuan.'], 422);
        }

        DB::transaction(function () use ($submissions, $data, $request) {
            foreach ($submissions as $submission) {
                $this->applySubmissionDecision(
                    $submission,
                    $data['action'],
                    $request->user(),
                    $data['notes'] ?? null
                );
            }
        });

        $verb = $data['action'] === 'approve' ? 'disetujui' : 'ditolak';

        return response()->json([
            'message' => "{$submissions->count()} laporan harian berhasil {$verb}.",
            'processed' => $submissions->count(),
        ]);
    }

    public static function resolveDraftSubmission(int $userId, string $activityDate): MechanicActivitySubmission
    {
        $submission = MechanicActivitySubmission::firstOrCreate(
            [
                'user_id' => $userId,
                'activity_date' => $activityDate,
            ],
            ['status' => 'draft']
        );

        if (! $submission->isEditableByMechanic()) {
            throw ValidationException::withMessages([
                'activity_date' => 'Aktivitas pada tanggal ini sudah diajukan atau disetujui supervisor.',
            ]);
        }

        if ($submission->status === 'rejected') {
            $submission->update([
                'status' => 'draft',
                'supervisor_notes' => null,
                'submitted_at' => null,
                'approved_by' => null,
                'approved_at' => null,
            ]);
        }

        return $submission;
    }

    public static function attachActivity(MechanicActivity $activity): void
    {
        $submission = self::resolveDraftSubmission(
            $activity->user_id,
            $activity->activity_date->format('Y-m-d')
        );

        $activity->submission_id = $submission->id;
        $activity->status = 'draft';
        $activity->save();

        $submission->refreshTotals();
    }

    private function submitSubmission(MechanicActivitySubmission $submission): int
    {
        $activities = $submission->activities()
            ->whereIn('status', ['draft', 'rejected'])
            ->get();

        if ($activities->isEmpty()) {
            return 0;
        }

        foreach ($activities as $activity) {
            $activity->update(['status' => 'pending_approval']);
        }

        $submission->update([
            'status' => 'pending_approval',
            'submitted_at' => now(),
            'supervisor_notes' => null,
            'approved_by' => null,
            'approved_at' => null,
        ]);
        $submission->refreshTotals();

        return $activities->count();
    }

    private function applySubmissionDecision(
        MechanicActivitySubmission $submission,
        string $action,
        User $approver,
        ?string $notes
    ): void {
        $workOrderIds = [];

        if ($action === 'reject') {
            $submission->activities()
                ->where('status', 'pending_approval')
                ->update([
                    'status' => 'rejected',
                    'supervisor_notes' => $notes,
                    'approved_by' => null,
                    'approved_at' => null,
                ]);

            $submission->syncStatusFromActivities($approver->id);

            if ($submission->fresh()->status === 'rejected') {
                $submission->update(['supervisor_notes' => $notes]);
            }

            return;
        }

        $submission->activities()
            ->where('status', 'pending_approval')
            ->each(function (MechanicActivity $activity) use ($approver, $notes, &$workOrderIds) {
                $activity->update([
                    'status' => 'approved',
                    'approved_by' => $approver->id,
                    'approved_at' => now(),
                    'supervisor_notes' => $notes,
                ]);

                if ($activity->work_order_id) {
                    $workOrderIds[$activity->work_order_id] = true;
                }
            });

        $submission->syncStatusFromActivities($approver->id);

        if ($submission->fresh()->status === 'approved') {
            $submission->update([
                'approved_by' => $approver->id,
                'approved_at' => now(),
                'supervisor_notes' => $notes,
            ]);
        }

        foreach (array_keys($workOrderIds) as $workOrderId) {
            WorkOrder::find($workOrderId)?->refreshWorkDetails();
        }
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<MechanicActivitySubmission>  $query
     */
    private function applySupervisorUserScope($query, User $viewer): void
    {
        if ($viewer->canViewAllDepartments()) {
            return;
        }

        $query->whereHas('user', fn ($userQuery) => $userQuery->visibleTo($viewer));
    }

    private function canSupervisorApproveSubmission(User $supervisor, MechanicActivitySubmission $submission): bool
    {
        if ($supervisor->canViewAllDepartments()) {
            return true;
        }

        $mechanic = $submission->relationLoaded('user')
            ? $submission->user
            : User::find($submission->user_id);

        return $mechanic?->isVisibleTo($supervisor) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    private function activityRelationLoads(): array
    {
        return [
            'activityType',
            'workOrder' => function ($query) {
                $query->withSum(
                    ['mechanicActivities as logged_hours_sum' => function ($activityQuery) {
                        $activityQuery
                            ->where('mode', 'working')
                            ->where('status', '!=', 'rejected');
                    }],
                    'total_hours'
                );
            },
        ];
    }
}
