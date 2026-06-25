<?php

use App\Models\WorkOrder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        WorkOrder::query()
            ->where('status', 'in_execution')
            ->orderBy('id')
            ->each(fn (WorkOrder $wo) => $wo->reconcileExecutionStatusFromActivities());
    }

    public function down(): void
    {
        // Tidak dapat dikembalikan otomatis.
    }
};
