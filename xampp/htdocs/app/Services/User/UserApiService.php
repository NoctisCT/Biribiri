<?php

namespace App\Services\User;

use App\Models\User;
use App\Services\EmulatorPresenceService;
use Illuminate\Database\Eloquent\Builder;

class UserApiService
{
    public function __construct(
        private readonly EmulatorPresenceService $presence
    ) {
    }

    public function fetchUser(
        string $username,
        array $columns
    ): User {
        return User::select($columns)
            ->where('username', '=', $username)
            ->first();
    }

    public function onlineUsers(
        $columns = [
            'username',
            'motto',
            'look',
        ],
        bool $randomOrder = true
    ): Builder {
        $this->presence
            ->normalizeGlobalPresence();

        $query = User::select($columns)
            ->where('online', '=', '1');

        if ($randomOrder) {
            $query = $query->inRandomOrder();
        }

        return $query;
    }

    public function onlineUserCount(): int
    {
        return $this->presence
            ->onlineUserCount();
    }
}
