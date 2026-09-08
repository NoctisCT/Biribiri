package com.retro.socialinteractions;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.messenger.Message;
import com.eu.habbo.habbohotel.modtool.WordFilter;
import com.eu.habbo.habbohotel.permissions.Permission;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomState;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.friends.FriendChatMessageComposer;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public final class PartyManager
{
    public static final int MAX_MEMBERS = 8;
    public static final int ACTION_LEAVE = 0;
    public static final int ACTION_KICK = 1;
    public static final int ACTION_TRANSFER = 2;
    public static final int ACTION_RALLY = 3;
    public static final int ACTION_DISBAND = 4;
    public static final int ACTION_REQUEST_STATE = 5;

    private static final long INVITE_TIMEOUT_MS = 15000L;
    private static final long CHAT_COOLDOWN_MS = 350L;
    private static final AtomicInteger NEXT_PARTY_ID = new AtomicInteger(1);
    private static final AtomicInteger NEXT_INVITE_ID = new AtomicInteger(1);
    private static final Map<Integer, Party> PARTIES = new ConcurrentHashMap<>();
    private static final Map<Integer, Integer> PARTY_BY_USER = new ConcurrentHashMap<>();
    private static final Map<Integer, PendingInvite> INVITES = new ConcurrentHashMap<>();
    private static final Map<Integer, Integer> INVITE_BY_USER = new ConcurrentHashMap<>();
    private static final Map<Integer, Long> LAST_CHAT = new ConcurrentHashMap<>();
    private static final Map<Integer, String> LAST_SIGNATURE = new ConcurrentHashMap<>();
    private static ScheduledExecutorService worker;

    private PartyManager() {}

    private static final class Party
    {
        final int id;
        int leaderId;
        final LinkedHashMap<Integer, Long> members = new LinkedHashMap<>();
        Party(int id, int leaderId) { this.id = id; this.leaderId = leaderId; }
    }

    private static final class PendingInvite
    {
        final int id, inviterId, targetId, existingPartyId;
        final long createdAt;
        PendingInvite(int id, int inviterId, int targetId, int existingPartyId)
        {
            this.id=id; this.inviterId=inviterId; this.targetId=targetId; this.existingPartyId=existingPartyId; this.createdAt=System.currentTimeMillis();
        }
    }

    public static synchronized void start()
    {
        if(worker != null) return;
        worker = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "Biribiri-Party"); t.setDaemon(true); return t; });
        worker.scheduleAtFixedRate(PartyManager::tick, 1000L, 1000L, TimeUnit.MILLISECONDS);
    }

    public static synchronized void stop()
    {
        if(worker != null) { worker.shutdownNow(); worker = null; }
        PARTIES.clear(); PARTY_BY_USER.clear(); INVITES.clear(); INVITE_BY_USER.clear(); LAST_CHAT.clear(); LAST_SIGNATURE.clear();
    }

    public static synchronized void invite(Habbo inviter, int targetUserId)
    {
        if(inviter == null) return;
        int inviterId = inviter.getHabboInfo().getId();
        if(targetUserId <= 0 || targetUserId == inviterId || INVITE_BY_USER.containsKey(inviterId) || INVITE_BY_USER.containsKey(targetUserId) || PARTY_BY_USER.containsKey(targetUserId)) return;

        Habbo target = online(targetUserId);
        if(target == null || !sameRoom(inviter, target)) return;

        int existingPartyId = 0;
        Integer currentPartyId = PARTY_BY_USER.get(inviterId);
        if(currentPartyId != null)
        {
            Party party = PARTIES.get(currentPartyId);
            if(party == null || party.leaderId != inviterId || party.members.size() >= MAX_MEMBERS) return;
            existingPartyId = party.id;
        }

        int inviteId = nextPositive(NEXT_INVITE_ID);
        PendingInvite invite = new PendingInvite(inviteId, inviterId, targetUserId, existingPartyId);
        INVITES.put(invite.id, invite);
        INVITE_BY_USER.put(inviterId, invite.id);
        INVITE_BY_USER.put(targetUserId, invite.id);

        ServerMessage response = new ServerMessage(InteractionPackets.PARTY_INVITE_EVENT);
        response.appendInt(invite.id);
        response.appendInt(inviterId);
        response.appendString(inviter.getHabboInfo().getUsername());
        response.appendInt(objectId(inviter));
        if(target.getClient() != null) target.getClient().sendResponse(response);
    }

    public static synchronized void respondInvite(Habbo target, int inviteId, boolean accepted)
    {
        if(target == null) return;
        PendingInvite invite = INVITES.get(inviteId);
        if(invite == null || invite.targetId != target.getHabboInfo().getId()) return;
        removeInvite(invite);
        if(!accepted || System.currentTimeMillis() - invite.createdAt > INVITE_TIMEOUT_MS) return;

        Habbo inviter = online(invite.inviterId);
        if(inviter == null || !sameRoom(inviter, target) || PARTY_BY_USER.containsKey(invite.targetId)) return;

        Party party;
        if(invite.existingPartyId > 0)
        {
            party = PARTIES.get(invite.existingPartyId);
            Integer inviterParty = PARTY_BY_USER.get(invite.inviterId);
            if(party == null || inviterParty == null || inviterParty != party.id || party.leaderId != invite.inviterId || party.members.size() >= MAX_MEMBERS) return;
        }
        else
        {
            if(PARTY_BY_USER.containsKey(invite.inviterId)) return;
            party = new Party(nextPositive(NEXT_PARTY_ID), invite.inviterId);
            addMember(party, invite.inviterId);
            PARTIES.put(party.id, party);
        }

        addMember(party, invite.targetId);
        broadcastState(party);
    }

    public static synchronized void action(Habbo user, int action, int targetUserId)
    {
        if(user == null) return;
        int userId = user.getHabboInfo().getId();
        Integer partyId = PARTY_BY_USER.get(userId);

        if(action == ACTION_REQUEST_STATE)
        {
            if(partyId == null) { sendInactive(user); return; }
            Party party = PARTIES.get(partyId);
            if(party == null) { PARTY_BY_USER.remove(userId); sendInactive(user); return; }
            sendState(user, party);
            return;
        }

        if(partyId == null) return;
        Party party = PARTIES.get(partyId);
        if(party == null) { PARTY_BY_USER.remove(userId); sendInactive(user); return; }

        switch(action)
        {
            case ACTION_LEAVE:
                removeMember(party, userId, true);
                break;
            case ACTION_KICK:
                if(party.leaderId == userId && targetUserId != userId && party.members.containsKey(targetUserId)) removeMember(party, targetUserId, true);
                break;
            case ACTION_TRANSFER:
                if(party.leaderId == userId && targetUserId != userId && party.members.containsKey(targetUserId)) { party.leaderId = targetUserId; broadcastState(party); }
                break;
            case ACTION_RALLY:
                if(party.leaderId == userId) rally(party, user);
                break;
            case ACTION_DISBAND:
                if(party.leaderId == userId) dissolve(party);
                break;
            default:
                break;
        }
    }

    public static synchronized void chat(Habbo sender, int requestedPartyId, String rawMessage)
    {
        if(sender == null || rawMessage == null) return;
        if(!sender.getHabboStats().allowTalk()) return;
        String text = rawMessage.trim();
        if(text.isEmpty() || text.length() > 255) return;

        int senderId = sender.getHabboInfo().getId();
        long now = System.currentTimeMillis();
        Long last = LAST_CHAT.get(senderId);
        if(last != null && now - last < CHAT_COOLDOWN_MS) return;

        Integer actualPartyId = PARTY_BY_USER.get(senderId);
        if(actualPartyId == null || actualPartyId != requestedPartyId) return;
        Party party = PARTIES.get(actualPartyId);
        if(party == null || !party.members.containsKey(senderId)) return;

        LAST_CHAT.put(senderId, now);
        if(WordFilter.ENABLED_FRIENDCHAT) text = Emulator.getGameEnvironment().getWordFilter().filter(text, sender);

        Message message = new Message(senderId, 0, text);
        int threadKey = threadKey(party.id);
        for(Integer memberId : new ArrayList<>(party.members.keySet()))
        {
            Habbo member = online(memberId);
            if(member == null || member.getClient() == null) continue;
            // toId negativo hace que FriendChatMessageComposer añada username/figure/userId.
            // No ejecutamos Message.run(): Party es efimera y no escribe chatlogs_private.
            member.getClient().sendResponse(new FriendChatMessageComposer(message, threadKey, senderId).compose());
        }
    }

    public static synchronized void visit(Habbo viewer, int targetUserId)
    {
        if(viewer == null || viewer.getClient() == null) return;
        Integer partyId = PARTY_BY_USER.get(viewer.getHabboInfo().getId());
        if(partyId == null) return;
        Party party = PARTIES.get(partyId);
        if(party == null || !party.members.containsKey(targetUserId)) return;
        Habbo target = online(targetUserId);
        if(target == null || target.getHabboInfo().getCurrentRoom() == null || sameRoom(viewer, target) || !canVisit(viewer, target)) return;
        // goToRoom solo manda ForwardToRoom normal; no overrideChecks ni bypass.
        viewer.goToRoom(target.getHabboInfo().getCurrentRoom().getId());
    }

    public static synchronized void onDisconnect(int userId)
    {
        Integer inviteId = INVITE_BY_USER.get(userId);
        if(inviteId != null) { PendingInvite invite = INVITES.get(inviteId); if(invite != null) removeInvite(invite); }
        LAST_CHAT.remove(userId);
        Integer partyId = PARTY_BY_USER.get(userId);
        if(partyId == null) return;
        Party party = PARTIES.get(partyId);
        if(party == null) { PARTY_BY_USER.remove(userId); return; }
        removeMember(party, userId, false);
    }

    private static synchronized void tick()
    {
        try
        {
            long now = System.currentTimeMillis();
            for(PendingInvite invite : new ArrayList<>(INVITES.values())) if(now - invite.createdAt > INVITE_TIMEOUT_MS) removeInvite(invite);

            for(Party party : new ArrayList<>(PARTIES.values()))
            {
                if(!PARTIES.containsKey(party.id)) continue;
                for(Integer memberId : new ArrayList<>(party.members.keySet()))
                {
                    if(online(memberId) == null)
                    {
                        removeMember(party, memberId, false);
                        if(!PARTIES.containsKey(party.id)) break;
                    }
                }
                if(!PARTIES.containsKey(party.id)) continue;
                String signature = signature(party);
                if(!signature.equals(LAST_SIGNATURE.get(party.id))) broadcastState(party);
            }
        }
        catch(Exception exception) { exception.printStackTrace(); }
    }

    private static void rally(Party party, Habbo leader)
    {
        if(party == null || leader == null || leader.getHabboInfo().getCurrentRoom() == null) return;
        Room room = leader.getHabboInfo().getCurrentRoom();
        for(Integer memberId : new ArrayList<>(party.members.keySet()))
        {
            if(memberId == leader.getHabboInfo().getId()) continue;
            Habbo member = online(memberId);
            if(member == null || member.getClient() == null || sameRoom(member, leader)) continue;
            ServerMessage response = new ServerMessage(InteractionPackets.PARTY_RALLY);
            response.appendInt(leader.getHabboInfo().getId());
            response.appendString(leader.getHabboInfo().getUsername());
            response.appendString(room.getName());
            response.appendInt(canVisit(member, leader) ? 1 : 0);
            member.getClient().sendResponse(response);
        }
    }

    private static void addMember(Party party, int userId)
    {
        if(party == null || party.members.containsKey(userId)) return;
        party.members.put(userId, System.nanoTime());
        PARTY_BY_USER.put(userId, party.id);
    }

    private static void removeMember(Party party, int userId, boolean notify)
    {
        if(party == null || !party.members.containsKey(userId)) return;
        party.members.remove(userId);
        PARTY_BY_USER.remove(userId, party.id);
        LAST_CHAT.remove(userId);
        if(notify) sendInactive(online(userId));
        if(party.members.size() < 2) { dissolve(party); return; }
        if(party.leaderId == userId) party.leaderId = party.members.keySet().iterator().next();
        broadcastState(party);
    }

    private static void dissolve(Party party)
    {
        if(party == null) return;
        for(Integer memberId : new ArrayList<>(party.members.keySet()))
        {
            PARTY_BY_USER.remove(memberId, party.id);
            LAST_CHAT.remove(memberId);
            sendInactive(online(memberId));
        }
        party.members.clear();
        PARTIES.remove(party.id);
        LAST_SIGNATURE.remove(party.id);
    }

    private static void broadcastState(Party party)
    {
        if(party == null) return;
        for(Integer memberId : new ArrayList<>(party.members.keySet()))
        {
            Habbo member = online(memberId);
            if(member != null) sendState(member, party);
        }
        LAST_SIGNATURE.put(party.id, signature(party));
    }

    private static void sendState(Habbo viewer, Party party)
    {
        if(viewer == null || viewer.getClient() == null || party == null) return;
        ServerMessage response = new ServerMessage(InteractionPackets.PARTY_STATE);
        response.appendInt(1);
        response.appendInt(party.id);
        response.appendInt(threadKey(party.id));
        response.appendInt(party.leaderId);
        response.appendInt(viewer.getHabboInfo().getId());
        response.appendInt(party.members.size());

        for(Integer memberId : party.members.keySet())
        {
            Habbo member = online(memberId);
            if(member == null)
            {
                response.appendInt(memberId); response.appendString("Desconectado"); response.appendString(""); response.appendInt(0); response.appendString("Fuera de sala"); response.appendInt(0); response.appendInt(0);
                continue;
            }
            Room room = member.getHabboInfo().getCurrentRoom();
            response.appendInt(memberId);
            response.appendString(member.getHabboInfo().getUsername());
            response.appendString(member.getHabboInfo().getLook());
            response.appendInt(room == null ? 0 : room.getId());
            response.appendString(room == null ? "Fuera de sala" : room.getName());
            response.appendInt(canVisit(viewer, member) ? 1 : 0);
            response.appendInt(sameRoom(viewer, member) ? 1 : 0);
        }
        viewer.getClient().sendResponse(response);
    }

    private static void sendInactive(Habbo user)
    {
        if(user == null || user.getClient() == null) return;
        ServerMessage response = new ServerMessage(InteractionPackets.PARTY_STATE);
        response.appendInt(0);
        user.getClient().sendResponse(response);
    }

    private static void removeInvite(PendingInvite invite)
    {
        if(invite == null) return;
        INVITES.remove(invite.id);
        INVITE_BY_USER.remove(invite.inviterId, invite.id);
        INVITE_BY_USER.remove(invite.targetId, invite.id);
    }

    private static boolean canVisit(Habbo viewer, Habbo target)
    {
        if(viewer == null || target == null) return false;

        Room room =
                target.getHabboInfo()
                        .getCurrentRoom();

        if(
            room == null
            || sameRoom(viewer, target)
        )
        {
            return false;
        }

        RoomState state =
                room.getState();

        /*
         * Party solo decide si podemos INICIAR
         * la navegacion normal.
         *
         * OPEN     -> entra normalmente.
         * LOCKED   -> flujo normal muestra/toca timbre.
         * PASSWORD -> flujo normal solicita password.
         * INVISIBLE-> no se ofrece a usuario normal.
         *
         * viewer.goToRoom() sigue siendo un ForwardToRoom
         * normal: Party nunca ignora timbre/password.
         */
        return (
            state == RoomState.OPEN
            || state == RoomState.LOCKED
            || state == RoomState.PASSWORD
            || room.isOwner(viewer)
            || viewer.hasPermission(
                    Permission.ACC_ENTERANYROOM
            )
            || viewer.hasPermission(
                    Permission.ACC_ANYROOMOWNER
            )
        );
    }

    private static boolean sameRoom(Habbo a, Habbo b)
    {
        if(a == null || b == null || a.getRoomUnit() == null || b.getRoomUnit() == null) return false;
        Room ar = a.getHabboInfo().getCurrentRoom(), br = b.getHabboInfo().getCurrentRoom();
        return ar != null && br != null && ar.getId() == br.getId();
    }

    private static String signature(Party party)
    {
        StringBuilder out = new StringBuilder().append(party.leaderId);
        for(Integer memberId : party.members.keySet())
        {
            Habbo member = online(memberId);
            if(member == null || member.getHabboInfo().getCurrentRoom() == null) { out.append('|').append(memberId).append(":0:-1"); continue; }
            Room room = member.getHabboInfo().getCurrentRoom();
            out.append('|').append(memberId).append(':').append(room.getId()).append(':').append(room.getState().getState()).append(':').append(room.getName());
        }
        return out.toString();
    }

    private static Habbo online(int userId) { return Emulator.getGameEnvironment().getHabboManager().getHabbo(userId); }
    private static int objectId(Habbo habbo) { return habbo != null && habbo.getRoomUnit() != null ? habbo.getRoomUnit().getId() : -1; }
    private static int threadKey(int partyId) { return -(1000000 + partyId); }
    private static int nextPositive(AtomicInteger source) { int value = source.getAndIncrement(); if(value > 0) return value; source.set(2); return 1; }
}
