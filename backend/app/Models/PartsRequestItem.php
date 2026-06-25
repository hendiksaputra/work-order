<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartsRequestItem extends Model
{
    protected $fillable = [
        'parts_request_id', 'part_name', 'part_number',
        'qty', 'unit', 'in_stock', 'is_outstanding', 'unit_cost', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'decimal:2',
            'unit_cost' => 'decimal:2',
            'in_stock' => 'boolean',
            'is_outstanding' => 'boolean',
        ];
    }

    public function partsRequest(): BelongsTo
    {
        return $this->belongsTo(PartsRequest::class);
    }
}
