<?php

namespace App\Services\Clothing;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ClothingDesignerEligibilityService
{
    private const TEAM_NAME =
        'Diseñador de Ropa';

    public function designerCharacterIds(
        int $accountId
    ): array {
        if (
            ! Schema::hasTable('account_characters') ||
            ! Schema::hasTable('user_website_team') ||
            ! Schema::hasTable('website_teams')
        ) {
            return [];
        }

        $query = DB::table(
            'account_characters as ac'
        )
            ->join(
                'user_website_team as uwt',
                'uwt.user_id',
                '=',
                'ac.user_id'
            )
            ->join(
                'website_teams as wt',
                'wt.id',
                '=',
                'uwt.website_team_id'
            )
            ->where(
                'ac.account_id',
                $accountId
            )
            ->whereNull(
                'ac.archived_at'
            )
            ->where(
                'wt.rank_name',
                self::TEAM_NAME
            );

        return $query
            ->distinct()
            ->pluck('ac.user_id')
            ->map(
                static fn ($value): int =>
                    (int) $value
            )
            ->values()
            ->all();
    }

    public function isStaffUser(
        int $userId
    ): bool {
        if (! Schema::hasTable('users')) {
            return false;
        }

        return (int) DB::table('users')
            ->where('id', $userId)
            ->value('rank') >= 6;
    }

    public function canSubmit(
        int $accountId,
        int $authenticatedUserId
    ): bool {
        return $this->isStaffUser(
            $authenticatedUserId
        ) || $this->designerCharacterIds(
            $accountId
        ) !== [];
    }

    public function creatorCharacters(
        int $accountId,
        int $authenticatedUserId
    ): Collection {
        if (
            ! Schema::hasTable('users') ||
            ! Schema::hasTable('account_characters')
        ) {
            return collect();
        }

        $designerIds =
            $this->designerCharacterIds(
                $accountId
            );

        $query = DB::table('users')
            ->join(
                'account_characters as ac',
                'ac.user_id',
                '=',
                'users.id'
            )
            ->where(
                'ac.account_id',
                $accountId
            )
            ->whereNull(
                'ac.archived_at'
            )
            ->orderBy('ac.slot')
            ->select([
                'users.id',
                'users.username',
                'ac.is_primary',
            ]);

        if (
            ! $this->isStaffUser(
                $authenticatedUserId
            )
        ) {
            if ($designerIds === []) {
                return collect();
            }

            $query->whereIn(
                'users.id',
                $designerIds
            );
        }

        return $query->get();
    }

    public function canUseCreator(
        int $accountId,
        int $authenticatedUserId,
        int $creatorUserId
    ): bool {
        return $this->creatorCharacters(
            $accountId,
            $authenticatedUserId
        )
            ->contains(
                static fn ($character): bool =>
                    (int) $character->id ===
                    $creatorUserId
            );
    }
}