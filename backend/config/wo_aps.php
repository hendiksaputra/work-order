<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Tarif tenaga kerja (labor) per jam
    |--------------------------------------------------------------------------
    | Dipakai laporan Cost Report: biaya labor = jam aktivitas disetujui × tarif.
    | Atur via .env: WO_LABOR_HOURLY_RATE=150000
    */
    'labor_hourly_rate' => (float) env('WO_LABOR_HOURLY_RATE', 150000),

    /*
    | Jam kerja standar per orang per hari (Utilization Report).
    */
    'standard_hours_per_day' => (float) env('WO_STANDARD_HOURS_PER_DAY', 8),

];
