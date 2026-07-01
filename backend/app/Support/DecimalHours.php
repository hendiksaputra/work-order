<?php

namespace App\Support;

class DecimalHours
{
    /** Format jam desimal ke jam.menit, mis. 1.3 → "1.18 h". */
    public static function format(float|string|null $hours): string
    {
        $totalMinutes = (int) round(((float) $hours) * 60);
        $h = intdiv($totalMinutes, 60);
        $m = $totalMinutes % 60;

        return sprintf('%d.%02d h', $h, $m);
    }
}
