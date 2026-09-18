<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClothingSale extends Model
{
    protected $fillable = [
        'purchase_id',
        'clothing_product_id',
        'buyer_user_id',
        'quantity',
        'currency_type',
        'points_type',
        'gross_amount',
        'creator_amount',
        'burn_amount',
        'status',
        'delivered_item_ids',
        'charge_transaction_id',
        'payout_transaction_id',
        'refund_transaction_id',
        'manual_review_reason',
        'charged_at',
        'delivered_at',
        'payout_at',
        'refunded_at',
    ];

    protected $casts = [
        'delivered_item_ids' => 'array',
        'charged_at' => 'datetime',
        'delivered_at' => 'datetime',
        'payout_at' => 'datetime',
        'refunded_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(
            ClothingProduct::class,
            'clothing_product_id'
        );
    }

    public function rewards(): HasMany
    {
        return $this->hasMany(
            ClothingSaleReward::class,
            'clothing_sale_id'
        );
    }
}