<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClothingProductReward extends Model
{
    public const TYPE_BADGE = 'badge';

    public const TIMING_PURCHASE = 'purchase';

    protected $fillable = [
        'clothing_product_id',
        'reward_type',
        'reward_key',
        'grant_timing',
        'once_per_user',
        'metadata',
    ];

    protected $casts = [
        'once_per_user' => 'boolean',
        'metadata' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(
            ClothingProduct::class,
            'clothing_product_id'
        );
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(
            ClothingSaleReward::class,
            'clothing_product_reward_id'
        );
    }
}