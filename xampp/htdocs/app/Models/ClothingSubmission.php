<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ClothingSubmission extends Model
{
    protected $fillable = [
        'account_id',
        'creator_user_id',
        'source_mode',
        'source_path',
        'original_filename',
        'clothing_name',
        'tag',
        'designer_comment',
        'requested_category',
        'final_category',
        'intended_acquisition_method',
        'package_kind',
        'piece_count',
        'piece_manifest',
        'status',
        'technical_status',
        'technical_report',
        'preview_manifest',
        'clothing_code',
        'clothing_library_codes',
        'redeemable_furni_code',
        'source_fingerprint',
        'clothing_catalog_id',
        'redeemable_base_item_id',
        'designer_reward_base_item_id',
        'moderator_user_id',
        'moderation_reason',
        'approved_at',
        'rejected_at',
    ];

    protected $casts = [
        'technical_report' => 'array',
        'preview_manifest' => 'array',
        'piece_manifest' => 'array',
        'clothing_library_codes' => 'array',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    public function product(): HasOne
    {
        return $this->hasOne(
            ClothingProduct::class,
            'clothing_submission_id'
        );
    }
}