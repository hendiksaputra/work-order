<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->enum('delay_cause', ['spare_part', 'manpower', 'tools', 'other'])->nullable()->after('closed_at');
            $table->text('delay_notes')->nullable()->after('delay_cause');
            $table->date('component_installed_at')->nullable()->after('component_serial');
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn(['delay_cause', 'delay_notes', 'component_installed_at']);
        });
    }
};
