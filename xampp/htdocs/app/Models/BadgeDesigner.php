<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BadgeDesigner extends Model
{
    protected $table = 'badge_designers';

    public $timestamps = false;

    protected $fillable = [
        'account_id',
        'active',
        'granted_by_user_id',
        'granted_at',
        'revoked_at',
        'notes',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'active' => 'boolean',
        'granted_at' => 'datetime',
        'revoked_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
