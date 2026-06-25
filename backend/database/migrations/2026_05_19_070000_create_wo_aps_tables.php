<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('employee_id')->nullable()->unique()->after('id');
            $table->enum('role', ['admin', 'planner', 'mechanic', 'supervisor', 'logistic'])->default('mechanic')->after('password');
            $table->string('department')->nullable()->after('role');
            $table->boolean('is_active')->default(true)->after('department');
        });

        Schema::create('activity_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('category', ['productive', 'non_productive', 'mechanic_skill']);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('work_orders', function (Blueprint $table) {
            $table->id();
            $table->string('wo_number')->unique();
            $table->enum('type', ['main', 'sub']);
            $table->foreignId('parent_id')->nullable()->constrained('work_orders')->nullOnDelete();
            $table->enum('main_category', ['component', 'unit', 'other'])->nullable();
            $table->enum('workshop', ['rebuild', 'fabrication', 'support'])->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('component_name')->nullable();
            $table->string('component_serial')->nullable();
            $table->string('unit_model')->nullable();
            $table->string('unit_number')->nullable();
            $table->string('location')->nullable();
            $table->enum('status', [
                'draft',
                'pending_supervisor',
                'approved',
                'in_execution',
                'qc_pending',
                'qc_approved',
                'closed',
                'rejected',
            ])->default('draft');
            $table->unsignedSmallInteger('manpower_count')->default(1);
            $table->decimal('estimated_hours', 8, 2)->default(0);
            $table->decimal('target_hours', 8, 2)->nullable();
            $table->decimal('actual_hours', 8, 2)->default(0);
            $table->decimal('material_cost', 12, 2)->default(0);
            $table->text('work_details')->nullable();
            $table->text('supervisor_notes')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('work_order_status_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('mechanic_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('activity_type_id')->constrained();
            $table->enum('mode', ['working', 'standby'])->default('working');
            $table->date('activity_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->decimal('total_hours', 8, 2)->default(0);
            $table->text('notes')->nullable();
            $table->enum('status', ['draft', 'pending_approval', 'approved', 'rejected'])->default('draft');
            $table->text('supervisor_notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('parts_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_number')->unique();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->enum('workshop', ['rebuild', 'fabrication', 'support']);
            $table->enum('status', [
                'draft',
                'pending_approval',
                'approved',
                'logistic_check',
                'taken',
                'rejected',
            ])->default('draft');
            $table->text('notes')->nullable();
            $table->text('supervisor_notes')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('logistic_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('parts_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parts_request_id')->constrained()->cascadeOnDelete();
            $table->string('part_name');
            $table->string('part_number')->nullable();
            $table->decimal('qty', 10, 2)->default(1);
            $table->string('unit')->default('pcs');
            $table->boolean('in_stock')->default(true);
            $table->boolean('is_outstanding')->default(false);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parts_request_items');
        Schema::dropIfExists('parts_requests');
        Schema::dropIfExists('mechanic_activities');
        Schema::dropIfExists('work_order_status_logs');
        Schema::dropIfExists('work_orders');
        Schema::dropIfExists('activity_types');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['employee_id', 'role', 'department', 'is_active']);
        });
    }
};
