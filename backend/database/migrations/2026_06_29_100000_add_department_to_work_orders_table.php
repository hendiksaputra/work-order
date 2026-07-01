<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->string('department', 100)->nullable()->after('workshop');
        });

        $orders = DB::table('work_orders')->orderBy('id')->get(['id', 'parent_id', 'created_by']);

        foreach ($orders as $wo) {
            $dept = DB::table('users')->where('id', $wo->created_by)->value('department');
            DB::table('work_orders')->where('id', $wo->id)->update(['department' => $dept]);
        }
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn('department');
        });
    }
};
