<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use Illuminate\Http\Request;

class WorkshopSettingsController extends Controller
{
    public function show()
    {
        return response()->json(AppSetting::workshopMeta());
    }

    public function updateLaborRate(Request $request)
    {
        $data = $request->validate([
            'labor_hourly_rate' => 'required|numeric|min:0|max:999999999',
        ]);

        $rate = (float) $data['labor_hourly_rate'];
        AppSetting::setLaborHourlyRate($rate, $request->user()->id);

        return response()->json([
            'message' => 'Tarif labour berhasil disimpan.',
            ...AppSetting::workshopMeta(),
        ]);
    }

    public function updateStandardHours(Request $request)
    {
        $data = $request->validate([
            'standard_hours_per_day' => 'required|numeric|min:1|max:24',
        ]);

        $hours = (float) $data['standard_hours_per_day'];
        AppSetting::setStandardHoursPerDay($hours, $request->user()->id);

        return response()->json([
            'message' => 'Jam kerja standar berhasil disimpan.',
            ...AppSetting::workshopMeta(),
        ]);
    }
}
