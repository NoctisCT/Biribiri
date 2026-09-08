package com.retro.socialinteractions;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.ServerMessage;

import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class FollowManager
{
    private static final long TICK_MS = 300L;
    private static final double KEEP_DISTANCE = 1.5D;

    private static final Map<Integer, FollowSession> SESSIONS =
            new ConcurrentHashMap<>();

    private static final Set<Integer> INTERNAL_GOAL_CHANGES =
            ConcurrentHashMap.newKeySet();

    private static ScheduledExecutorService worker;

    private FollowManager()
    {
    }

    private static final class FollowSession
    {
        final int followerId;
        int targetId;

        FollowSession(
                int followerId,
                int targetId)
        {
            this.followerId = followerId;
            this.targetId = targetId;
        }
    }

    public static synchronized void start()
    {
        if(worker != null) return;

        worker = Executors.newSingleThreadScheduledExecutor(runnable ->
        {
            Thread thread = new Thread(
                    runnable,
                    "Biribiri-Follow"
            );

            thread.setDaemon(true);

            return thread;
        });

        worker.scheduleAtFixedRate(
                FollowManager::tick,
                TICK_MS,
                TICK_MS,
                TimeUnit.MILLISECONDS
        );
    }

    public static synchronized void stop()
    {
        if(worker != null)
        {
            worker.shutdownNow();
            worker = null;
        }

        SESSIONS.clear();
        INTERNAL_GOAL_CHANGES.clear();
    }

    public static synchronized void toggle(
            Habbo follower,
            int targetUserId)
    {
        if(follower == null) return;

        int followerId =
                follower.getHabboInfo().getId();

        FollowSession current =
                SESSIONS.get(followerId);

        if(
            current != null &&
            current.targetId == targetUserId
        )
        {
            SESSIONS.remove(followerId);

            haltOwnMovement(follower);

            sendState(
                    follower,
                    false,
                    0,
                    ""
            );

            return;
        }

        Habbo target = getOnline(
                targetUserId
        );

        if(
            target == null ||
            targetUserId == followerId ||
            !sameRoom(follower, target)
        )
        {
            sendState(
                    follower,
                    false,
                    0,
                    ""
            );

            return;
        }

        FollowSession session =
                new FollowSession(
                        followerId,
                        targetUserId
                );

        SESSIONS.put(
                followerId,
                session
        );

        sendState(
                follower,
                true,
                targetUserId,
                target.getHabboInfo().getUsername()
        );

        updateOne(
                session
        );
    }

    public static void onGoalSet(
            Room room,
            RoomUnit roomUnit)
    {
        if(
            room == null ||
            roomUnit == null
        )
        {
            return;
        }

        Habbo habbo =
                room.getHabbo(roomUnit);

        if(habbo == null)
        {
            return;
        }

        int userId =
                habbo.getHabboInfo().getId();

        if(
            INTERNAL_GOAL_CHANGES.contains(
                    userId
            )
        )
        {
            return;
        }

        FollowSession session =
                SESSIONS.remove(userId);

        if(session == null)
        {
            return;
        }

        /*
         * Un cambio de goal que NO ha emitido
         * FollowManager es movimiento manual
         * (o cualquier otra acción voluntaria).
         * No alteramos ese goal: simplemente
         * dejamos de seguir.
         */
        sendState(
                habbo,
                false,
                0,
                ""
        );
    }

    public static synchronized void onDisconnect(
            int userId)
    {
        FollowSession own =
                SESSIONS.remove(userId);

        if(own != null)
        {
            INTERNAL_GOAL_CHANGES.remove(
                    userId
            );
        }

        for(
            FollowSession session :
            new ArrayList<>(SESSIONS.values())
        )
        {
            if(session.targetId != userId)
            {
                continue;
            }

            SESSIONS.remove(
                    session.followerId
            );

            Habbo follower =
                    getOnline(
                            session.followerId
                    );

            sendState(
                    follower,
                    false,
                    0,
                    ""
            );
        }
    }

    private static void tick()
    {
        try
        {
            for(
                FollowSession session :
                new ArrayList<>(SESSIONS.values())
            )
            {
                updateOne(session);
            }
        }
        catch(Exception exception)
        {
            exception.printStackTrace();
        }
    }

    private static void updateOne(
            FollowSession session)
    {
        Habbo follower =
                getOnline(
                        session.followerId
                );

        Habbo target =
                getOnline(
                        session.targetId
                );

        if(
            follower == null ||
            target == null ||
            !sameRoom(follower, target)
        )
        {
            SESSIONS.remove(
                    session.followerId
            );

            sendState(
                    follower,
                    false,
                    0,
                    ""
            );

            return;
        }

        RoomUnit followerUnit =
                follower.getRoomUnit();

        RoomUnit targetUnit =
                target.getRoomUnit();

        RoomTile followerLocation =
                followerUnit.getCurrentLocation();

        RoomTile targetLocation =
                targetUnit.getCurrentLocation();

        if(
            followerLocation == null ||
            targetLocation == null
        )
        {
            return;
        }

        if(!followerUnit.canWalk())
        {
            return;
        }

        double distance =
                followerLocation.distance(
                        targetLocation
                );

        if(distance <= KEEP_DISTANCE)
        {
            /*
             * Si ya llegó al usuario y aún
             * estaba caminando hacia una meta
             * antigua, detenemos ese recorrido.
             */
            if(followerUnit.isWalking())
            {
                issueGoal(
                        follower,
                        followerLocation
                );
            }

            return;
        }

        RoomTile desired =
                followerUnit
                        .getClosestAdjacentTile(
                                targetUnit.getX(),
                                targetUnit.getY(),
                                true
                        );

        if(desired == null)
        {
            return;
        }

        RoomTile currentGoal =
                followerUnit.getGoal();

        if(
            sameTile(
                    currentGoal,
                    desired
            )
        )
        {
            return;
        }

        issueGoal(
                follower,
                desired
        );
    }

    private static void issueGoal(
            Habbo follower,
            RoomTile goal)
    {
        if(
            follower == null ||
            follower.getRoomUnit() == null ||
            goal == null
        )
        {
            return;
        }

        int userId =
                follower.getHabboInfo().getId();

        INTERNAL_GOAL_CHANGES.add(
                userId
        );

        try
        {
            follower.getRoomUnit()
                    .setGoalLocation(goal);
        }
        finally
        {
            INTERNAL_GOAL_CHANGES.remove(
                    userId
            );
        }
    }

    private static void haltOwnMovement(
            Habbo follower)
    {
        if(
            follower == null ||
            follower.getRoomUnit() == null ||
            follower.getRoomUnit()
                    .getCurrentLocation() == null
        )
        {
            return;
        }

        issueGoal(
                follower,
                follower.getRoomUnit()
                        .getCurrentLocation()
        );
    }

    private static boolean sameTile(
            RoomTile first,
            RoomTile second)
    {
        if(first == second)
        {
            return true;
        }

        if(
            first == null ||
            second == null
        )
        {
            return false;
        }

        return (
            first.x == second.x &&
            first.y == second.y
        );
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

    private static void sendState(
            Habbo follower,
            boolean active,
            int targetUserId,
            String targetName)
    {
        if(
            follower == null ||
            follower.getClient() == null
        )
        {
            return;
        }

        ServerMessage message =
                new ServerMessage(
                        InteractionPackets
                                .FOLLOW_STATE
                );

        message.appendInt(
                active ? 1 : 0
        );

        message.appendInt(
                targetUserId
        );

        message.appendString(
                targetName == null
                        ? ""
                        : targetName
        );

        follower.getClient()
                .sendResponse(message);
    }
}
