<?php

namespace Database\Seeders;

use App\Models\AppSetting;
use Illuminate\Database\Seeder;

class AppSettingSeeder extends Seeder
{
    public function run(): void
    {
        if (! AppSetting::tableAvailable()) {
            return;
        }

        if (! AppSetting::hasStored(AppSetting::KEY_LABOR_HOURLY_RATE)) {
            AppSetting::setLaborHourlyRate((float) config('wo_aps.labor_hourly_rate', 150000));
        }
    }
}
