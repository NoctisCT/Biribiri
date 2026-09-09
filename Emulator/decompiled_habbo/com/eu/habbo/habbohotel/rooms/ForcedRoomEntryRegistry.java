package com.eu.habbo.habbohotel.rooms;

import com.eu.habbo.habbohotel.users.Habbo;

import java.util.concurrent.ConcurrentHashMap;

public final class ForcedRoomEntryRegistry
{
    private static final long DEFAULT_TTL_MS = 15000L;

    private static final ConcurrentHashMap<Integer, Grant> GRANTS =
            new ConcurrentHashMap<Integer, Grant>();

    private ForcedRoomEntryRegistry()
    {
    }

    public static void arm(Habbo habbo, int roomId)
    {
        if(habbo == null || habbo.getHabboInfo() == null || roomId <= 0)
            return;

        GRANTS.put(
                habbo.getHabboInfo().getId(),
                new Grant(roomId, System.currentTimeMillis() + DEFAULT_TTL_MS)
        );
    }

    public static boolean consume(Habbo habbo, int roomId)
    {
        if(habbo == null || habbo.getHabboInfo() == null || roomId <= 0)
            return false;

        int userId = habbo.getHabboInfo().getId();
        Grant grant = GRANTS.get(userId);

        if(grant == null)
            return false;

        long now = System.currentTimeMillis();

        if(grant.expiresAt < now)
        {
            GRANTS.remove(userId, grant);
            return false;
        }

        if(grant.roomId != roomId)
            return false;

        return GRANTS.remove(userId, grant);
    }

    public static void clear(Habbo habbo)
    {
        if(habbo == null || habbo.getHabboInfo() == null)
            return;

        GRANTS.remove(habbo.getHabboInfo().getId());
    }

    private static final class Grant
    {
        private final int roomId;
        private final long expiresAt;

        private Grant(int roomId, long expiresAt)
        {
            this.roomId = roomId;
            this.expiresAt = expiresAt;
        }
    }
}