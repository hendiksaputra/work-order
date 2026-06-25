<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PartsRequest extends Model
{
    protected $fillable = [
        'request_number', 'work_order_id', 'workshop', 'status',
        'notes', 'supervisor_notes', 'created_by',
        'approved_by', 'logistic_by', 'approved_at',
    ];

    protected function casts(): array
    {
        return ['approved_at' => 'datetime'];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PartsRequestItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function logisticUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'logistic_by');
    }
}
