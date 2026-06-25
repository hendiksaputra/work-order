<?php

namespace App\Support;

use Carbon\Carbon;

class WorkshopSchedule
{
    public const LUNCH_START = '12:00';

    public const LUNCH_END_WEEKDAY = '13:00';

    public const LUNCH_END_FRIDAY = '13:30';

    public const STANDARD_WORK_END = '18:00';

    public static function lunchEndForDate(?string $activityDate = null): string
    {
        if ($activityDate && Carbon::parse($activityDate)->isFriday()) {
            return self::LUNCH_END_FRIDAY;
        }

        return self::LUNCH_END_WEEKDAY;
    }

    public static function lunchBreakLabel(?string $activityDate = null): string
    {
        return self::LUNCH_START.'–'.self::lunchEndForDate($activityDate);
    }

    /** Sesi pagi berakhir saat istirahat tanpa lanjut kerja siang. */
    public static function endedDuringLunchWithoutResume(string $start, string $end, ?string $activityDate = null): bool
    {
        $startMins = self::timeToMinutes($start);
        $endMins = self::timeToMinutes($end);
        if ($endMins <= $startMins) {
            $endMins += 24 * 60;
        }

        $lunchStart = self::timeToMinutes(self::LUNCH_START);
        $lunchEnd = self::timeToMinutes(self::lunchEndForDate($activityDate));

        return $startMins < $lunchStart && $endMins >= $lunchStart && $endMins <= $lunchEnd;
    }

    /** @return list<array{type: 'work'|'break', start: string, end: string}> */
    public static function splitAroundLunchBreak(string $start, string $end, ?string $activityDate = null): array
    {
        $startMins = self::timeToMinutes($start);
        $endMins = self::timeToMinutes($end);
        if ($endMins <= $startMins) {
            $endMins += 24 * 60;
        }

        $lunchStart = self::timeToMinutes(self::LUNCH_START);
        $lunchEnd = self::timeToMinutes(self::lunchEndForDate($activityDate));
        $lunchEndTime = self::lunchEndForDate($activityDate);

        if ($endMins < $lunchStart) {
            return [['type' => 'work', 'start' => $start, 'end' => $end]];
        }

        if ($startMins >= $lunchEnd) {
            return [['type' => 'work', 'start' => $start, 'end' => $end]];
        }

        if (self::endedDuringLunchWithoutResume($start, $end, $activityDate)) {
            return [
                ['type' => 'work', 'start' => $start, 'end' => self::LUNCH_START],
                ['type' => 'break', 'start' => self::LUNCH_START, 'end' => $lunchEndTime],
            ];
        }

        $segments = [];

        if ($startMins < $lunchStart) {
            $segEnd = min($endMins, $lunchStart);
            if ($segEnd > $startMins) {
                $segments[] = [
                    'type' => 'work',
                    'start' => self::minutesToTime($startMins),
                    'end' => self::minutesToTime($segEnd),
                ];
            }
        }

        $overlapStart = max($startMins, $lunchStart);
        $overlapEnd = min($endMins, $lunchEnd);
        if ($overlapEnd > $overlapStart) {
            $segments[] = [
                'type' => 'break',
                'start' => self::minutesToTime($overlapStart),
                'end' => self::minutesToTime($overlapEnd),
            ];
        }

        if ($endMins > $lunchEnd) {
            $segStart = max($startMins, $lunchEnd);
            if ($endMins > $segStart) {
                $segments[] = [
                    'type' => 'work',
                    'start' => self::minutesToTime($segStart),
                    'end' => self::minutesToTime($endMins),
                ];
            }
        }

        if ($segments === []) {
            $segments[] = ['type' => 'work', 'start' => $start, 'end' => $end];
        }

        return $segments;
    }

    public static function lunchOverlapMinutes(string $start, string $end, ?string $activityDate = null): int
    {
        if (self::endedDuringLunchWithoutResume($start, $end, $activityDate)) {
            return self::durationMinutes(self::LUNCH_START, self::lunchEndForDate($activityDate));
        }

        $startMins = self::timeToMinutes($start);
        $endMins = self::timeToMinutes($end);
        if ($endMins <= $startMins) {
            $endMins += 24 * 60;
        }

        if ($startMins >= self::timeToMinutes(self::lunchEndForDate($activityDate))) {
            return 0;
        }

        $lunchStart = self::timeToMinutes(self::LUNCH_START);
        $lunchEnd = self::timeToMinutes(self::lunchEndForDate($activityDate));
        $overlapStart = max($startMins, $lunchStart);
        $overlapEnd = min($endMins, $lunchEnd);

        return max(0, $overlapEnd - $overlapStart);
    }

    public static function exceedsStandardWorkEnd(string $end): bool
    {
        return self::timeToMinutes($end) > self::timeToMinutes(self::STANDARD_WORK_END);
    }

    /**
     * @return list<array{type: 'work', start: string, end: string, overtime: bool}>
     */
    public static function splitWorkAndOvertime(string $start, string $end): array
    {
        $startMins = self::timeToMinutes($start);
        $endMins = self::timeToMinutes($end);
        if ($endMins <= $startMins) {
            $endMins += 24 * 60;
        }

        $workEndMins = self::timeToMinutes(self::STANDARD_WORK_END);

        if ($endMins <= $workEndMins) {
            return [['type' => 'work', 'start' => $start, 'end' => $end, 'overtime' => false]];
        }

        if ($startMins >= $workEndMins) {
            return [['type' => 'work', 'start' => $start, 'end' => $end, 'overtime' => true]];
        }

        return [
            ['type' => 'work', 'start' => $start, 'end' => self::STANDARD_WORK_END, 'overtime' => false],
            ['type' => 'work', 'start' => self::STANDARD_WORK_END, 'end' => $end, 'overtime' => true],
        ];
    }

    public static function durationMinutes(string $start, string $end): int
    {
        $startMins = self::timeToMinutes($start);
        $endMins = self::timeToMinutes($end);
        if ($endMins <= $startMins) {
            $endMins += 24 * 60;
        }

        return max(0, $endMins - $startMins);
    }

    public static function timeToMinutes(string $time): int
    {
        $parts = explode(':', substr($time, 0, 5));

        return (int) $parts[0] * 60 + (int) $parts[1];
    }

    public static function minutesToTime(int $minutes): string
    {
        $minutes = (($minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
        $h = intdiv($minutes, 60);
        $m = $minutes % 60;

        return sprintf('%02d:%02d', $h, $m);
    }
}
