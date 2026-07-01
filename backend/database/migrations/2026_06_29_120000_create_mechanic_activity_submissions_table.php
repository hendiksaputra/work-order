<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mechanic_activity_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('activity_date');
            $table->enum('status', ['draft', 'pending_approval', 'approved', 'rejected'])->default('draft');
            $table->unsignedInteger('activities_count')->default(0);
            $table->decimal('total_hours', 8, 2)->default(0);
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('supervisor_notes')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'activity_date']);
        });

        Schema::table('mechanic_activities', function (Blueprint $table) {
            $table->foreignId('submission_id')
                ->nullable()
                ->after('user_id')
                ->constrained('mechanic_activity_submissions')
                ->nullOnDelete();
        });

        $groups = DB::table('mechanic_activities')
            ->select('user_id', 'activity_date')
            ->distinct()
            ->orderBy('activity_date')
            ->get();

        foreach ($groups as $group) {
            $activities = DB::table('mechanic_activities')
                ->where('user_id', $group->user_id)
                ->whereDate('activity_date', $group->activity_date)
                ->get(['id', 'status', 'total_hours', 'approved_by', 'approved_at', 'supervisor_notes']);

            if ($activities->isEmpty()) {
                continue;
            }

            $statuses = $activities->pluck('status')->unique()->values();
            $submissionStatus = 'draft';
            if ($statuses->contains('pending_approval')) {
                $submissionStatus = 'pending_approval';
            } elseif ($statuses->every(fn ($s) => $s === 'approved')) {
                $submissionStatus = 'approved';
            } elseif ($statuses->contains('rejected')) {
                $submissionStatus = 'rejected';
            }

            $approvedRow = $activities->firstWhere('status', 'approved');
            $submittedAt = $submissionStatus !== 'draft'
                ? now()
                : null;

            $submissionId = DB::table('mechanic_activity_submissions')->insertGetId([
                'user_id' => $group->user_id,
                'activity_date' => $group->activity_date,
                'status' => $submissionStatus,
                'activities_count' => $activities->count(),
                'total_hours' => $activities->sum('total_hours'),
                'submitted_at' => $submittedAt,
                'approved_by' => $approvedRow?->approved_by,
                'approved_at' => $approvedRow?->approved_at,
                'supervisor_notes' => $activities->firstWhere('supervisor_notes', '!=', null)?->supervisor_notes,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('mechanic_activities')
                ->whereIn('id', $activities->pluck('id'))
                ->update(['submission_id' => $submissionId]);
        }
    }

    public function down(): void
    {
        Schema::table('mechanic_activities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('submission_id');
        });

        Schema::dropIfExists('mechanic_activity_submissions');
    }
};
