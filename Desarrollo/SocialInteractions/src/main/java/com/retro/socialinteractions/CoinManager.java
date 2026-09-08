package com.retro.socialinteractions;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.ServerMessage;

import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public final class CoinManager
{
    private static final int EVENT_INVITE = 0;
    private static final int EVENT_PENDING = 1;
    private static final int EVENT_REJECTED = 2;
    private static final int EVENT_CANCELLED = 3;
    private static final int EVENT_UNAVAILABLE = 4;
    private static final int EVENT_RESULT = 5;

    private static final long CHALLENGE_COOLDOWN_MS = 2200L;
    private static final long CHALLENGE_TIMEOUT_MS = 15000L;

    private static final AtomicInteger NEXT_ID = new AtomicInteger(1);

    private static final Map<Integer, CoinChallenge> CHALLENGES =
            new ConcurrentHashMap<>();

    private static final Map<Integer, Integer> CHALLENGE_BY_USER =
            new ConcurrentHashMap<>();

    private static final Map<Integer, Long> LAST_CHALLENGE =
            new ConcurrentHashMap<>();

    private static ScheduledExecutorService cleaner;

    private CoinManager()
    {
    }

    private static final class CoinChallenge
    {
        final int id;
        final int initiatorId;
        final int targetId;
        final int roomId;
        final long createdAt;

        CoinChallenge(
                int id,
                Habbo initiator,
                Habbo target,
                int roomId)
        {
            this.id = id;
            this.initiatorId = initiator.getHabboInfo().getId();
            this.targetId = target.getHabboInfo().getId();
            this.roomId = roomId;
            this.createdAt = System.currentTimeMillis();
        }
    }

    public static synchronized void start()
    {
        if(cleaner != null)
        {
            return;
        }

        cleaner = Executors.newSingleThreadScheduledExecutor(runnable ->
        {
            Thread thread = new Thread(
                    runnable,
                    "Biribiri-Coin-Cleanup"
            );

            thread.setDaemon(true);

            return thread;
        });

        cleaner.scheduleAtFixedRate(
                CoinManager::cleanupExpired,
                2,
                2,
                TimeUnit.SECONDS
        );
    }

    public static synchronized void stop()
    {
        if(cleaner != null)
        {
            cleaner.shutdownNow();
            cleaner = null;
        }

        CHALLENGES.clear();
        CHALLENGE_BY_USER.clear();
        LAST_CHALLENGE.clear();
    }

    public static synchronized void challenge(
            Habbo initiator,
            int targetUserId)
    {
        int initiatorId =
                initiator.getHabboInfo().getId();

        if(
            targetUserId <= 0 ||
            targetUserId == initiatorId
        )
        {
            sendPrivate(
                    initiator,
                    EVENT_UNAVAILABLE,
                    0,
                    objectId(initiator),
                    objectId(initiator),
                    -1,
                    -1,
                    -1
            );

            return;
        }

        long now =
                System.currentTimeMillis();

        Long last =
                LAST_CHALLENGE.get(initiatorId);

        if(
            last != null &&
            (now - last) < CHALLENGE_COOLDOWN_MS
        )
        {
            sendPrivate(
                    initiator,
                    EVENT_UNAVAILABLE,
                    0,
                    objectId(initiator),
                    objectId(initiator),
                    -1,
                    -1,
                    -1
            );

            return;
        }

        Habbo target =
                getOnline(targetUserId);

        if(
            target == null ||
            !sameRoom(initiator, target) ||
            CHALLENGE_BY_USER.containsKey(initiatorId) ||
            CHALLENGE_BY_USER.containsKey(targetUserId)
        )
        {
            sendPrivate(
                    initiator,
                    EVENT_UNAVAILABLE,
                    0,
                    objectId(initiator),
                    objectId(initiator),
                    objectId(target),
                    -1,
                    -1
            );

            return;
        }

        LAST_CHALLENGE.put(
                initiatorId,
                now
        );

        Room room =
                initiator
                        .getHabboInfo()
                        .getCurrentRoom();

        int challengeId =
                NEXT_ID.getAndIncrement();

        if(challengeId <= 0)
        {
            NEXT_ID.set(1);
            challengeId =
                    NEXT_ID.getAndIncrement();
        }

        CoinChallenge challenge =
                new CoinChallenge(
                        challengeId,
                        initiator,
                        target,
                        room.getId()
                );

        CHALLENGES.put(
                challenge.id,
                challenge
        );

        CHALLENGE_BY_USER.put(
                challenge.initiatorId,
                challenge.id
        );

        CHALLENGE_BY_USER.put(
                challenge.targetId,
                challenge.id
        );

        sendPrivate(
                initiator,
                EVENT_PENDING,
                challenge.id,
                objectId(initiator),
                objectId(initiator),
                objectId(target),
                -1,
                -1
        );

        sendPrivate(
                target,
                EVENT_INVITE,
                challenge.id,
                objectId(initiator),
                objectId(initiator),
                objectId(target),
                -1,
                -1
        );
    }

    public static synchronized void respond(
            Habbo target,
            int challengeId,
            boolean accepted)
    {
        CoinChallenge challenge =
                CHALLENGES.get(challengeId);

        if(challenge == null)
        {
            return;
        }

        int targetId =
                target.getHabboInfo().getId();

        if(challenge.targetId != targetId)
        {
            return;
        }

        Habbo initiator =
                getOnline(challenge.initiatorId);

        if(
            initiator == null ||
            !sameRoom(initiator, target) ||
            initiator.getHabboInfo()
                    .getCurrentRoom()
                    .getId()
                    != challenge.roomId
        )
        {
            cancelChallenge(challenge);
            return;
        }

        if(!accepted)
        {
            sendPrivate(
                    initiator,
                    EVENT_REJECTED,
                    challenge.id,
                    objectId(initiator),
                    objectId(initiator),
                    objectId(target),
                    -1,
                    -1
            );

            remove(challenge);
            return;
        }

        int result =
                ThreadLocalRandom
                        .current()
                        .nextInt(2);

        int initiatorObjectId =
                objectId(initiator);

        int targetObjectId =
                objectId(target);

        int winnerObjectId =
                result == 0
                        ? initiatorObjectId
                        : targetObjectId;

        ServerMessage message =
                new ServerMessage(
                        InteractionPackets.COIN_RESULT
                );

        message.appendInt(EVENT_RESULT);
        message.appendInt(challenge.id);
        message.appendInt(-1);
        message.appendInt(initiatorObjectId);
        message.appendInt(targetObjectId);
        message.appendInt(result);
        message.appendInt(winnerObjectId);

        initiator
                .getHabboInfo()
                .getCurrentRoom()
                .sendComposer(message);

        remove(challenge);
    }

    public static synchronized void onDisconnect(
            int userId)
    {
        Integer challengeId =
                CHALLENGE_BY_USER.get(userId);

        if(challengeId == null)
        {
            LAST_CHALLENGE.remove(userId);
            return;
        }

        CoinChallenge challenge =
                CHALLENGES.get(challengeId);

        if(challenge != null)
        {
            int opponentId =
                    challenge.initiatorId == userId
                            ? challenge.targetId
                            : challenge.initiatorId;

            Habbo opponent =
                    getOnline(opponentId);

            if(opponent != null)
            {
                sendPrivate(
                        opponent,
                        EVENT_CANCELLED,
                        challenge.id,
                        objectId(opponent),
                        objectId(getOnline(challenge.initiatorId)),
                        objectId(getOnline(challenge.targetId)),
                        -1,
                        -1
                );
            }

            remove(challenge);
        }

        LAST_CHALLENGE.remove(userId);
    }

    private static synchronized void cleanupExpired()
    {
        long now =
                System.currentTimeMillis();

        for(
            CoinChallenge challenge :
            new ArrayList<>(CHALLENGES.values())
        )
        {
            if(
                (now - challenge.createdAt)
                < CHALLENGE_TIMEOUT_MS
            )
            {
                continue;
            }

            cancelChallenge(challenge);
        }
    }

    private static void cancelChallenge(
            CoinChallenge challenge)
    {
        Habbo initiator =
                getOnline(challenge.initiatorId);

        Habbo target =
                getOnline(challenge.targetId);

        sendPrivate(
                initiator,
                EVENT_CANCELLED,
                challenge.id,
                objectId(initiator),
                objectId(initiator),
                objectId(target),
                -1,
                -1
        );

        sendPrivate(
                target,
                EVENT_CANCELLED,
                challenge.id,
                objectId(target),
                objectId(initiator),
                objectId(target),
                -1,
                -1
        );

        remove(challenge);
    }

    private static void remove(
            CoinChallenge challenge)
    {
        CHALLENGES.remove(challenge.id);

        CHALLENGE_BY_USER.remove(
                challenge.initiatorId,
                challenge.id
        );

        CHALLENGE_BY_USER.remove(
                challenge.targetId,
                challenge.id
        );
    }

    private static void sendPrivate(
            Habbo user,
            int eventType,
            int challengeId,
            int displayObjectId,
            int initiatorObjectId,
            int targetObjectId,
            int result,
            int winnerObjectId)
    {
        if(
            user == null ||
            user.getClient() == null
        )
        {
            return;
        }

        ServerMessage message =
                new ServerMessage(
                        InteractionPackets.COIN_RESULT
                );

        message.appendInt(eventType);
        message.appendInt(challengeId);
        message.appendInt(displayObjectId);
        message.appendInt(initiatorObjectId);
        message.appendInt(targetObjectId);
        message.appendInt(result);
        message.appendInt(winnerObjectId);

        user.getClient()
                .sendResponse(message);
    }

    private static boolean sameRoom(
            Habbo first,
            Habbo second)
    {
        if(
            first == null ||
            second == null ||
            first.getRoomUnit() == null ||
            second.getRoomUnit() == null
        )
        {
            return false;
        }

        Room firstRoom =
                first.getHabboInfo()
                        .getCurrentRoom();

        Room secondRoom =
                second.getHabboInfo()
                        .getCurrentRoom();

        return (
            firstRoom != null &&
            secondRoom != null &&
            firstRoom.getId()
                    == secondRoom.getId()
        );
    }

    private static Habbo getOnline(
            int userId)
    {
        return Emulator
                .getGameEnvironment()
                .getHabboManager()
                .getHabbo(userId);
    }

    private static int objectId(
            Habbo habbo)
    {
        return (
            habbo != null &&
            habbo.getRoomUnit() != null
        )
                ? habbo.getRoomUnit().getId()
                : -1;
    }
}
