<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Schema;

class AppSetting extends Model
{
    public const KEY_LABOR_HOURLY_RATE = 'labor_hourly_rate';

    public const KEY_STANDARD_HOURS_PER_DAY = 'standard_hours_per_day';

    protected $fillable = [
        'key',
        'value',
        'updated_by',
    ];

    public function updatedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function tableAvailable(): bool
    {
        return Schema::hasTable('app_settings');
    }

    public static function hasStored(string $key): bool
    {
        if (! self::tableAvailable()) {
            return false;
        }

        return static::where('key', $key)->exists();
    }

    public static function laborHourlyRate(): float
    {
        if (self::tableAvailable()) {
            $stored = static::where('key', self::KEY_LABOR_HOURLY_RATE)->value('value');
            if ($stored !== null && $stored !== '') {
                return max(0, (float) $stored);
            }
        }

        return max(0, (float) config('wo_aps.labor_hourly_rate', 150000));
    }

    public static function setLaborHourlyRate(float $rate, ?int $updatedBy = null): self
    {
        return static::updateOrCreate(
            ['key' => self::KEY_LABOR_HOURLY_RATE],
            [
                'value' => (string) max(0, $rate),
                'updated_by' => $updatedBy,
            ]
        );
    }

    public static function getFloat(string $key, float $default): float
    {
        if (self::tableAvailable()) {
            $stored = static::where('key', $key)->value('value');
            if ($stored !== null && $stored !== '') {
                return max(0, (float) $stored);
            }
        }

        return $default;
    }

    public static function standardHoursPerDay(): float
    {
        return self::getFloat(
            self::KEY_STANDARD_HOURS_PER_DAY,
            (float) config('wo_aps.standard_hours_per_day', 8)
        );
    }

    public static function setFloat(string $key, float $value, ?int $updatedBy = null): self
    {
        return static::updateOrCreate(
            ['key' => $key],
            [
                'value' => (string) max(0, $value),
                'updated_by' => $updatedBy,
            ]
        );
    }

    public static function setStandardHoursPerDay(float $hours, ?int $updatedBy = null): self
    {
        return self::setFloat(self::KEY_STANDARD_HOURS_PER_DAY, $hours, $updatedBy);
    }

    public static function laborRateMeta(): array
    {
        return self::workshopMeta();
    }

    public static function workshopMeta(): array
    {
        $laborStored = self::tableAvailable()
            ? static::with('updatedByUser')->where('key', self::KEY_LABOR_HOURLY_RATE)->first()
            : null;
        $hoursStored = self::tableAvailable()
            ? static::with('updatedByUser')->where('key', self::KEY_STANDARD_HOURS_PER_DAY)->first()
            : null;

        return [
            'labor_hourly_rate' => self::laborHourlyRate(),
            'default_labor_hourly_rate' => max(0, (float) config('wo_aps.labor_hourly_rate', 150000)),
            'labor_source' => $laborStored ? 'database' : 'default',
            'labor_updated_at' => $laborStored?->updated_at,
            'labor_updated_by_name' => $laborStored?->updatedByUser?->name,
            'standard_hours_per_day' => self::standardHoursPerDay(),
            'default_standard_hours_per_day' => max(0, (float) config('wo_aps.standard_hours_per_day', 8)),
            'hours_source' => $hoursStored ? 'database' : 'default',
            'hours_updated_at' => $hoursStored?->updated_at,
            'hours_updated_by_name' => $hoursStored?->updatedByUser?->name,
            // backward compat for Cost Report settings UI
            'source' => $laborStored ? 'database' : 'default',
            'updated_at' => $laborStored?->updated_at,
            'updated_by_name' => $laborStored?->updatedByUser?->name,
        ];
    }
}
