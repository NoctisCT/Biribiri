package com.retro.builderpro;

import com.eu.habbo.habbohotel.users.Habbo;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

public final class BuilderProRateLimiter
{
    public static final long GLOBAL_MUTATION_MS = 50L;
    public static final long STATE_MS = 300L;
    public static final long BACKUP_MUTATION_MS = 750L;
    public static final long BACKUP_RESTORE_MS = 2000L;

    public static final int NO_LIMIT_ITEM_COUNT = 10;
    public static final long ITEMS_11_TO_50_MS = 75L;
    public static final long ITEMS_51_TO_100_MS = 125L;
    public static final long ITEMS_101_TO_250_MS = 200L;
    public static final long ITEMS_251_TO_500_MS = 300L;
    public static final long ITEMS_501_TO_1000_MS = 450L;
    public static final long ITEMS_1001_PLUS_MS = 750L;

    private static final ConcurrentMap<String, Long> LAST_ACCEPTED =
            new ConcurrentHashMap<String, Long>();

    private BuilderProRateLimiter()
    {
    }

    public static Result acquireItems(
            Habbo actor,
            String bucket,
            long itemCount)
    {
        if(itemCount <= NO_LIMIT_ITEM_COUNT)
        {
            return Result.allow();
        }

        return acquire(
                actor,
                bucket,
                cooldownForItems(
                        itemCount
                )
        );
    }

    public static long cooldownForItems(
            long itemCount)
    {
        long count =
                Math.max(
                        0L,
                        itemCount
                );

        if(count <= NO_LIMIT_ITEM_COUNT)
        {
            return 0L;
        }

        if(count <= 50L)
        {
            return ITEMS_11_TO_50_MS;
        }

        if(count <= 100L)
        {
            return ITEMS_51_TO_100_MS;
        }

        if(count <= 250L)
        {
            return ITEMS_101_TO_250_MS;
        }

        if(count <= 500L)
        {
            return ITEMS_251_TO_500_MS;
        }

        if(count <= 1000L)
        {
            return ITEMS_501_TO_1000_MS;
        }

        return ITEMS_1001_PLUS_MS;
    }

    public static Result acquire(
            Habbo actor,
            String bucket,
            long cooldownMs)
    {
        if(actor == null
                || actor.getHabboInfo() == null)
        {
            return Result.reject(
                    cooldownMs,
                    "Usuario no disponible."
            );
        }

        int actorId =
                actor.getHabboInfo().getId();

        long now =
                System.currentTimeMillis();

        Result global =
                acquireKey(
                        actorId + ":global",
                        GLOBAL_MUTATION_MS,
                        now
                );

        if(!global.allowed)
        {
            return global;
        }

        return acquireKey(
                actorId
                        + ":"
                        + (
                            bucket == null
                                    ? "default"
                                    : bucket
                        ),
                cooldownMs,
                now
        );
    }

    private static Result acquireKey(
            String key,
            long cooldownMs,
            long now)
    {
        AtomicBoolean allowed =
                new AtomicBoolean(false);

        AtomicLong retryAfter =
                new AtomicLong(cooldownMs);

        LAST_ACCEPTED.compute(
                key,
                (ignored, lastAccepted) ->
                {
                    if(lastAccepted == null)
                    {
                        allowed.set(true);
                        retryAfter.set(0L);
                        return now;
                    }

                    long elapsed =
                            now - lastAccepted.longValue();

                    if(elapsed >= cooldownMs)
                    {
                        allowed.set(true);
                        retryAfter.set(0L);
                        return now;
                    }

                    retryAfter.set(
                            Math.max(
                                    1L,
                                    cooldownMs - elapsed
                            )
                    );

                    return lastAccepted;
                }
        );

        if(allowed.get())
        {
            return Result.allow();
        }

        long remaining =
                retryAfter.get();

        return Result.reject(
                remaining,
                "Espera "
                        + remaining
                        + " ms antes de repetir esta operacion."
        );
    }

    public static void clear(
            int actorId)
    {
        String prefix =
                actorId + ":";

        LAST_ACCEPTED.keySet()
                .removeIf(
                        key ->
                                key.startsWith(prefix)
                );
    }

    public static final class Result
    {
        public final boolean allowed;
        public final long retryAfterMs;
        public final String message;

        private Result(
                boolean allowed,
                long retryAfterMs,
                String message)
        {
            this.allowed = allowed;
            this.retryAfterMs = retryAfterMs;
            this.message = message;
        }

        public static Result allow()
        {
            return new Result(
                    true,
                    0L,
                    ""
            );
        }

        public static Result reject(
                long retryAfterMs,
                String message)
        {
            return new Result(
                    false,
                    retryAfterMs,
                    message
            );
        }
    }
}
