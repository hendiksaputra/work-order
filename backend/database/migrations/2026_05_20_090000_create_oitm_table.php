<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('OITM', function (Blueprint $table) {
            $table->id();
            $table->string('U_MIS_UnitNo', 100);
            $table->string('U_MIS_ModeNo', 255);
            $table->timestamps();

            $table->index('U_MIS_UnitNo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('OITM');
    }
};
