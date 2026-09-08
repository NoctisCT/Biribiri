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
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public final class DuelManager
{
    public static final int STATE_PENDING = 0;
    public static final int STATE_ACTIVE = 1;
    public static final int STATE_REJECTED = 2;
    public static final int STATE_CANCELLED = 3;
    public static final int STATE_UNAVAILABLE = 4;
    public static final int STATE_CHOICE_LOCKED = 5;

    public static final int ROCK = 0;
    public static final int PAPER = 1;
    public static final int SCISSORS = 2;

    private static final long CHALLENGE_COOLDOWN_MS = 2500L;
    private static final long PENDING_TIMEOUT_MS = 15000L;
    private static final long ACTIVE_TIMEOUT_MS = 20000L;

    private static final AtomicInteger NEXT_ID = new AtomicInteger(1);
    private static final Map<Integer, Duel> DUELS = new ConcurrentHashMap<>();
    private static final Map<Integer, Integer> DUEL_BY_USER = new ConcurrentHashMap<>();
    private static final Map<Integer, Long> LAST_CHALLENGE = new ConcurrentHashMap<>();

    private static ScheduledExecutorService cleaner;

    private DuelManager() {}

    private static final class Duel
    {
        final int id;
        final int challengerId;
        final String challengerName;
        final int targetId;
        final String targetName;
        final int roomId;

        int state = STATE_PENDING;
        int challengerChoice = -1;
        int targetChoice = -1;
        long updatedAt = System.currentTimeMillis();

        Duel(int id, Habbo challenger, Habbo target, int roomId)
        {
            this.id = id;
            this.challengerId = challenger.getHabboInfo().getId();
            this.challengerName = challenger.getHabboInfo().getUsername();
            this.targetId = target.getHabboInfo().getId();
            this.targetName = target.getHabboInfo().getUsername();
            this.roomId = roomId;
        }

        boolean contains(int userId)
        {
            return challengerId == userId || targetId == userId;
        }

        int opponentId(int userId)
        {
            return challengerId == userId ? targetId : challengerId;
        }

        String opponentName(int userId)
        {
            return challengerId == userId ? targetName : challengerName;
        }
    }

    public static synchronized void start()
    {
        if(cleaner != null) return;

        cleaner = Executors.newSingleThreadScheduledExecutor(runnable ->
        {
            Thread thread = new Thread(runnable, "Biribiri-Duel-Cleanup");
            thread.setDaemon(true);
            return thread;
        });

        cleaner.scheduleAtFixedRate(DuelManager::cleanupExpired, 2, 2, TimeUnit.SECONDS);
    }

    public static synchronized void stop()
    {
        if(cleaner != null)
        {
            cleaner.shutdownNow();
            cleaner = null;
        }

        DUELS.clear();
        DUEL_BY_USER.clear();
        LAST_CHALLENGE.clear();
    }

    public static synchronized void challenge(Habbo challenger, int targetUserId)
    {
        if(challenger == null) return;

        int challengerId = challenger.getHabboInfo().getId();
        long now = System.currentTimeMillis();
        Long last = LAST_CHALLENGE.get(challengerId);

        if(last != null && (now - last) < CHALLENGE_COOLDOWN_MS)
        {
            sendState(challenger, 0, STATE_UNAVAILABLE, "", -1);
            return;
        }

        LAST_CHALLENGE.put(challengerId, now);

        if(targetUserId <= 0 || targetUserId == challengerId)
        {
            sendState(challenger, 0, STATE_UNAVAILABLE, "", -1);
            return;
        }

        Habbo target = getOnline(targetUserId);

        if(!sameRoom(challenger, target))
        {
            sendState(
                    challenger,
                    0,
                    STATE_UNAVAILABLE,
                    target != null ? target.getHabboInfo().getUsername() : "",
                    objectId(target)
            );
            return;
        }

        if(DUEL_BY_USER.containsKey(challengerId) || DUEL_BY_USER.containsKey(targetUserId))
        {
            sendState(challenger, 0, STATE_UNAVAILABLE, target.getHabboInfo().getUsername(), objectId(target));
            return;
        }

        Room room = challenger.getHabboInfo().getCurrentRoom();
        int duelId = NEXT_ID.getAndIncrement();

        if(duelId <= 0)
        {
            NEXT_ID.set(1);
            duelId = NEXT_ID.getAndIncrement();
        }

        Duel duel = new Duel(duelId, challenger, target, room.getId());

        DUELS.put(duel.id, duel);
        DUEL_BY_USER.put(duel.challengerId, duel.id);
        DUEL_BY_USER.put(duel.targetId, duel.id);

        sendState(challenger, duel.id, STATE_PENDING, duel.targetName, objectId(target));
        sendInvite(target, challenger, duel);
    }

    public static synchronized void respond(Habbo user, int duelId, boolean accepted)
    {
        if(user == null) return;

        Duel duel = DUELS.get(duelId);
        if(duel == null) return;

        int userId = user.getHabboInfo().getId();

        if(duel.targetId != userId || duel.state != STATE_PENDING) return;

        Habbo challenger = getOnline(duel.challengerId);
        Habbo target = getOnline(duel.targetId);

        if(!sameRoom(challenger, target) ||
           challenger.getHabboInfo().getCurrentRoom().getId() != duel.roomId)
        {
            cancelDuel(duel);
            return;
        }

        if(!accepted)
        {
            sendState(challenger, duel.id, STATE_REJECTED, duel.targetName, objectId(target));
            sendState(target, duel.id, STATE_REJECTED, duel.challengerName, objectId(challenger));
            remove(duel);
            return;
        }

        duel.state = STATE_ACTIVE;
        duel.updatedAt = System.currentTimeMillis();

        sendState(challenger, duel.id, STATE_ACTIVE, duel.targetName, objectId(target));
        sendState(target, duel.id, STATE_ACTIVE, duel.challengerName, objectId(challenger));

        broadcastPublic(challenger.getHabboInfo().getCurrentRoom(), duel, true);
    }

    public static synchronized void choose(Habbo user, int duelId, int choice)
    {
        if(user == null || choice < ROCK || choice > SCISSORS) return;

        Duel duel = DUELS.get(duelId);

        if(duel == null || duel.state != STATE_ACTIVE) return;

        int userId = user.getHabboInfo().getId();

        if(!duel.contains(userId)) return;

        Habbo challenger = getOnline(duel.challengerId);
        Habbo target = getOnline(duel.targetId);

        if(!sameRoom(challenger, target) ||
           challenger.getHabboInfo().getCurrentRoom().getId() != duel.roomId)
        {
            cancelDuel(duel);
            return;
        }

        if(userId == duel.challengerId)
        {
            if(duel.challengerChoice != -1) return;
            duel.challengerChoice = choice;
        }
        else
        {
            if(duel.targetChoice != -1) return;
            duel.targetChoice = choice;
        }

        duel.updatedAt = System.currentTimeMillis();

        sendState(user, duel.id, STATE_CHOICE_LOCKED, duel.opponentName(userId), objectId(getOnline(duel.opponentId(userId))));

        if(duel.challengerChoice == -1 || duel.targetChoice == -1) return;

        Room room = challenger.getHabboInfo().getCurrentRoom();

        broadcastPublic(room, duel, false);
        broadcastResult(room, challenger, target, duel);

        remove(duel);
    }

    public static synchronized void onDisconnect(int userId)
    {
        Integer duelId = DUEL_BY_USER.get(userId);
        if(duelId == null) return;

        Duel duel = DUELS.get(duelId);

        if(duel == null)
        {
            DUEL_BY_USER.remove(userId);
            return;
        }

        Habbo opponent = getOnline(duel.opponentId(userId));

        if(opponent != null)
        {
            sendState(opponent, duel.id, STATE_CANCELLED, duel.opponentName(opponent.getHabboInfo().getId()), objectId(getOnline(userId)));
        }

        Room room = opponent != null ? opponent.getHabboInfo().getCurrentRoom() : null;

        if(room != null) broadcastPublic(room, duel, false);

        remove(duel);
    }

    private static synchronized void cleanupExpired()
    {
        long now = System.currentTimeMillis();

        for(Duel duel : new ArrayList<>(DUELS.values()))
        {
            long timeout = duel.state == STATE_PENDING ? PENDING_TIMEOUT_MS : ACTIVE_TIMEOUT_MS;

            if((now - duel.updatedAt) < timeout) continue;

            cancelDuel(duel);
        }
    }

    private static void cancelDuel(Duel duel)
    {
        Habbo challenger = getOnline(duel.challengerId);
        Habbo target = getOnline(duel.targetId);

        sendState(challenger, duel.id, STATE_CANCELLED, duel.targetName, objectId(target));
        sendState(target, duel.id, STATE_CANCELLED, duel.challengerName, objectId(challenger));

        Room room = challenger != null ? challenger.getHabboInfo().getCurrentRoom()
                : (target != null ? target.getHabboInfo().getCurrentRoom() : null);

        if(room != null) broadcastPublic(room, duel, false);

        remove(duel);
    }

    private static int outcome(int ownChoice, int opponentChoice)
    {
        if(ownChoice == opponentChoice) return 0;

        if((ownChoice == ROCK && opponentChoice == SCISSORS) ||
           (ownChoice == PAPER && opponentChoice == ROCK) ||
           (ownChoice == SCISSORS && opponentChoice == PAPER))
        {
            return 1;
        }

        return -1;
    }

    private static void broadcastResult(Room room, Habbo challenger, Habbo target, Duel duel)
    {
        if(room == null || challenger == null || target == null) return;

        int result = outcome(duel.challengerChoice, duel.targetChoice);
        int winnerObjectId = -1;

        if(result > 0) winnerObjectId = objectId(challenger);
        else if(result < 0) winnerObjectId = objectId(target);

        ServerMessage message = new ServerMessage(InteractionPackets.DUEL_RESULT);

        message.appendInt(duel.id);
        message.appendInt(objectId(challenger));
        message.appendInt(objectId(target));
        message.appendInt(duel.challengerChoice);
        message.appendInt(duel.targetChoice);
        message.appendInt(winnerObjectId);

        room.sendComposer(message);
    }

    private static void broadcastPublic(Room room, Duel duel, boolean active)
    {
        if(room == null) return;

        Habbo challenger = getOnline(duel.challengerId);
        Habbo target = getOnline(duel.targetId);

        if(challenger == null || target == null) return;

        ServerMessage message = new ServerMessage(InteractionPackets.DUEL_PUBLIC);

        message.appendInt(duel.id);
        message.appendInt(active ? 1 : 0);
        message.appendInt(objectId(challenger));
        message.appendInt(objectId(target));

        room.sendComposer(message);
    }

    private static void sendInvite(Habbo target, Habbo challenger, Duel duel)
    {
        if(target == null || target.getClient() == null || challenger == null) return;

        ServerMessage message = new ServerMessage(InteractionPackets.DUEL_INVITE);

        message.appendInt(duel.id);
        message.appendInt(duel.challengerId);
        message.appendString(duel.challengerName);
        message.appendInt(objectId(challenger));

        target.getClient().sendResponse(message);
    }

    private static void sendState(Habbo user, int duelId, int state, String opponentName, int opponentObjectId)
    {
        if(user == null || user.getClient() == null) return;

        ServerMessage message = new ServerMessage(InteractionPackets.DUEL_STATE);

        message.appendInt(duelId);
        message.appendInt(state);
        message.appendString(opponentName == null ? "" : opponentName);
        message.appendInt(opponentObjectId);
        message.appendInt(objectId(user));

        user.getClient().sendResponse(message);
    }

    private static boolean sameRoom(Habbo first, Habbo second)
    {
        if(first == null || second == null || first.getRoomUnit() == null || second.getRoomUnit() == null) return false;

        Room firstRoom = first.getHabboInfo().getCurrentRoom();
        Room secondRoom = second.getHabboInfo().getCurrentRoom();

        return firstRoom != null && secondRoom != null && firstRoom.getId() == secondRoom.getId();
    }

    private static Habbo getOnline(int userId)
    {
        return Emulator.getGameEnvironment().getHabboManager().getHabbo(userId);
    }

    private static int objectId(Habbo habbo)
    {
        return habbo != null && habbo.getRoomUnit() != null ? habbo.getRoomUnit().getId() : -1;
    }

    private static void remove(Duel duel)
    {
        DUELS.remove(duel.id);
        DUEL_BY_USER.remove(duel.challengerId, duel.id);
        DUEL_BY_USER.remove(duel.targetId, duel.id);
    }
}
