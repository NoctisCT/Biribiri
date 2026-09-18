<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClothingSaleReward extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_DELIVERING = 'delivering';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_SKIPPED_ALREADY_OWNED =
        'skipped_already_owned';
    public const STATUS_MANUAL_REVIEW = 'manual_review';

    protected $fillable = [
        'clothing_sale_id',
        'clothing_product_reward_id',
        'user_id',
        'status',
        'delivery_transaction_id',
        'error_message',
        'delivered_at',
    ];

    protected $casts = [
        'delivered_at' => 'datetime',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(
            ClothingSale::class,
            'clothing_sale_id'
        );
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(
            ClothingProductReward::class,
            'clothing_product_reward_id'
        );
    }
}