<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClothingProduct extends Model
{
    protected $fillable = [
        'clothing_submission_id',
        'creator_user_id',
        'acquisition_method',
        'name',
        'tag',
        'category',
        'package_kind',
        'piece_count',
        'piece_manifest',
        'web_visible',
        'web_section',
        'status',
        'currency_type',
        'points_type',
        'unit_price',
        'stock_mode',
        'stock_total',
        'sold_count',
        'purchase_limit_per_user',
        'starts_at',
        'weekly_window_ends_at',
        'retires_at',
        'keep_after_window_until_sold',
        'creator_share_percent',
        'burn_percent',
        'redeemable_base_item_id',
        'public_furni_tradeable',
        'designer_reward_base_item_id',
        'designer_reward_nontradeable',
        'designer_reward_due_at',
        'designer_reward_delivered_at',
        'staff_catalog_section',
    ];

    protected $casts = [
        'piece_manifest' => 'array',
        'web_visible' => 'boolean',
        'keep_after_window_until_sold' => 'boolean',
        'public_furni_tradeable' => 'boolean',
        'designer_reward_nontradeable' => 'boolean',
        'starts_at' => 'datetime',
        'weekly_window_ends_at' => 'datetime',
        'retires_at' => 'datetime',
        'designer_reward_due_at' => 'datetime',
        'designer_reward_delivered_at' => 'datetime',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(
            ClothingSubmission::class,
            'clothing_submission_id'
        );
    }

    public function sales(): HasMany
    {
        return $this->hasMany(
            ClothingSale::class,
            'clothing_product_id'
        );
    }

    public function rewards(): HasMany
    {
        return $this->hasMany(
            ClothingProductReward::class,
            'clothing_product_id'
        );
    }

    public function remainingStock(): ?int
    {
        if ($this->stock_mode !== 'limited') {
            return null;
        }

        return max(
            0,
            (int) $this->stock_total -
            (int) $this->sold_count
        );
    }
}