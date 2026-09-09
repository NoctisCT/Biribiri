package com.retro.rpgengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.ForcedRoomEntryRegistry;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.outgoing.rooms.ForwardToRoomComposer;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.EventPriority;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import com.eu.habbo.plugin.events.users.HabboAddedToRoomEvent;
import com.eu.habbo.plugin.events.users.UserDisconnectEvent;
import com.eu.habbo.plugin.events.users.UserEnterRoomEvent;
import com.eu.habbo.plugin.events.users.UserExitRoomEvent;
import com.eu.habbo.plugin.events.users.UserLoginEvent;
import com.eu.habbo.plugin.events.users.UserTakeStepEvent;
import com.retro.rpgengine.ServicioRpgEngine.Encounter;
import com.retro.rpgengine.ServicioRpgEngine.EncounterParticipant;
import com.retro.rpgengine.handlers.RpgEngineCommandHandler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class RpgEnginePlugin extends HabboPlugin implements EventListener
{
    public static final int PACKET_RPG_ENGINE_COMMAND = 5050;

    private final Set<Integer> disconnecting =
            java.util.Collections.newSetFromMap(new ConcurrentHashMap<Integer, Boolean>());

    private final Set<Integer> automaticRejoinPending =
            java.util.Collections.newSetFromMap(new ConcurrentHashMap<Integer, Boolean>());

    @Override
    public void onEnable()
    {
        Emulator.getPluginManager().registerEvents(this, this);
    }

    @EventHandler
    public void onEmulatorLoaded(EmulatorLoadedEvent event) throws Exception
    {
        BaseDatosRpgEngine.inicializar();

        Emulator.getGameServer().getPacketManager()
                .registerHandler(PACKET_RPG_ENGINE_COMMAND, RpgEngineCommandHandler.class);

        System.out.println("[RPGEngine] Project + STAT + Movement + Encounter V2 loaded.");
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onUserLogin(UserLoginEvent event)
    {
        if(event == null || event.habbo == null) return;

        int userId = event.habbo.getHabboInfo().getId();
        disconnecting.remove(userId);

        try
        {
            Encounter updated = ServicioRpgEngine.systemReconnectParticipant(userId);
            scheduleParticipantDeadlineCheck(updated, userId);
            scheduleAutomaticReconnectRejoin(event.habbo, updated);
        }
        catch(Exception error)
        {
            logEncounterEvent("login", userId, error);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onUserDisconnect(UserDisconnectEvent event)
    {
        if(event == null || event.habbo == null) return;

        Habbo habbo = event.habbo;
        int userId = habbo.getHabboInfo().getId();
        disconnecting.add(userId);

        try
        {
            Room room = habbo.getHabboInfo().getCurrentRoom();
            int x = 0;
            int y = 0;
            double z = 0.0;

            if(habbo.getRoomUnit() != null &&
               habbo.getRoomUnit().getCurrentLocation() != null)
            {
                x = habbo.getRoomUnit().getX();
                y = habbo.getRoomUnit().getY();
                z = habbo.getRoomUnit().getZ();
            }

            Encounter updated = ServicioRpgEngine.systemDisconnectParticipant(
                    userId,
                    room,
                    x,
                    y,
                    z
            );
            scheduleParticipantDeadlineCheck(updated, userId);
        }
        catch(Exception error)
        {
            logEncounterEvent("disconnect", userId, error);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onUserExitRoom(UserExitRoomEvent event)
    {
        if(event == null || event.habbo == null) return;

        Habbo habbo = event.habbo;
        int userId = habbo.getHabboInfo().getId();

        if(disconnecting.remove(userId))
            return;

        try
        {
            Room room = habbo.getHabboInfo().getCurrentRoom();

            if(room == null ||
               habbo.getRoomUnit() == null ||
               habbo.getRoomUnit().getCurrentLocation() == null)
                return;

            Encounter updated = ServicioRpgEngine.systemLeaveCombatRoom(
                    userId,
                    room,
                    habbo.getRoomUnit().getX(),
                    habbo.getRoomUnit().getY(),
                    habbo.getRoomUnit().getZ()
            );
            scheduleParticipantDeadlineCheck(updated, userId);
        }
        catch(Exception error)
        {
            logEncounterEvent("exit-room", userId, error);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onUserEnterRoom(UserEnterRoomEvent event)
    {
        if(event == null || event.habbo == null || event.room == null) return;

        int userId = event.habbo.getHabboInfo().getId();
        disconnecting.remove(userId);

        try
        {
            Encounter updated = ServicioRpgEngine.systemEnterRoom(userId, event.room);
            scheduleParticipantDeadlineCheck(updated, userId);
        }
        catch(Exception error)
        {
            logEncounterEvent("enter-room", userId, error);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onHabboAddedToRoom(HabboAddedToRoomEvent event)
    {
        if(event == null || event.habbo == null || event.room == null) return;

        final Habbo habbo = event.habbo;
        final Room room = event.room;
        final int userId = habbo.getHabboInfo().getId();

        // At this point Arcturus has added the avatar to the room.
        // Rejoin is delayed a fraction so the normal room-entry placement
        // finishes before RPGEngine restores the authoritative combat tile.
        Emulator.getThreading().run(() ->
        {
            try
            {
                ServicioRpgEngine.systemRejoinCombatRoom(habbo, room);
            }
            catch(Exception error)
            {
                logEncounterEvent("rejoin-room", userId, error);
            }
        }, 150L);
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onUserTakeStep(UserTakeStepEvent event)
    {
        if(event == null || event.habbo == null || event.toLocation == null) return;

        Habbo habbo = event.habbo;
        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null) return;

        int userId = habbo.getHabboInfo().getId();

        try
        {
            Encounter encounter = ServicioRpgEngine.getCurrentEncounterForUser(userId);

            if(encounter == null ||
               !"active".equals(encounter.status) ||
               encounter.roomId != room.getId())
                return;

            EncounterParticipant self = null;

            for(EncounterParticipant participant : encounter.participants)
            {
                if(participant.userId == userId)
                {
                    self = participant;
                    break;
                }
            }

            if(self == null || "left".equals(self.status))
                return;

            // During the tiny rejoin window the port position is not a combat
            // position. Do not let the avatar walk before server restoration.
            if("returning".equals(self.status) ||
               "disconnected".equals(self.status))
            {
                event.setCancelled(true);
                return;
            }

            if(ServicioRpgEngine.isReservedEncounterTileForParticipant(
                    userId,
                    room.getId(),
                    event.toLocation.x,
                    event.toLocation.y))
            {
                event.setCancelled(true);
            }
        }
        catch(Exception error)
        {
            logEncounterEvent("take-step", userId, error);
        }
    }

    private void scheduleAutomaticReconnectRejoin(
            final Habbo habbo,
            final Encounter encounter)
    {
        if(habbo == null || encounter == null ||
           !"active".equals(encounter.status))
            return;

        final int userId = habbo.getHabboInfo().getId();
        EncounterParticipant self = null;

        for(EncounterParticipant participant : encounter.participants)
        {
            if(participant.userId == userId)
            {
                self = participant;
                break;
            }
        }

        if(self == null ||
           !"returning".equals(self.status) ||
           !self.hasSavedPosition)
            return;

        if(!automaticRejoinPending.add(userId))
            return;

        final int encounterId = encounter.id;
        final int combatRoomId = encounter.roomId;

        // UserLoginEvent happens very early in the login lifecycle.
        // Give Arcturus a short moment to finish attaching the client/Habbo
        // before starting a server-authoritative room entry.
        Emulator.getThreading().run(() ->
        {
            try
            {
                if(habbo.getClient() == null)
                    return;

                Encounter refreshed = ServicioRpgEngine.getEncounter(encounterId);

                if(refreshed == null || !"active".equals(refreshed.status))
                    return;

                EncounterParticipant participant = null;

                for(EncounterParticipant value : refreshed.participants)
                {
                    if(value.userId == userId)
                    {
                        participant = value;
                        break;
                    }
                }

                if(participant == null ||
                   !"returning".equals(participant.status) ||
                   !participant.hasSavedPosition)
                    return;

                // Do not resurrect an Encounter into a room that is no longer
                // registered in this RPG.
                if(ServicioRpgEngine.getContext(combatRoomId, userId) == null)
                    return;

                Room currentRoom = habbo.getHabboInfo().getCurrentRoom();

                if(currentRoom != null && currentRoom.getId() == combatRoomId)
                {
                    ServicioRpgEngine.systemRejoinCombatRoom(habbo, currentRoom);
                    return;
                }

                // Match Arcturus' own server-side forwarding flow:
                // 1) tell Nitro to visually transition to the room;
                // 2) perform the authoritative room entry with access checks bypassed.
                if(currentRoom != null)
                {
                    Emulator.getGameEnvironment()
                            .getRoomManager()
                            .leaveRoom(habbo, currentRoom);
                }

                // Important: Arcturus' own summon/forward flow performs the
                // authoritative entry FIRST and only then tells Nitro to switch
                // visually to that room. Sending ForwardToRoom first makes Nitro
                // attempt a normal locked-room entry and can briefly trigger the
                // doorbell/password flow while the server already inserts the Habbo.
                ForcedRoomEntryRegistry.arm(habbo, combatRoomId);

                if(habbo.getClient() != null)
                {
                    habbo.getClient().sendResponse(
                            new ForwardToRoomComposer(combatRoomId)
                    );
                }
            }
            catch(Exception error)
            {
                logEncounterEvent("automatic-rejoin", userId, error);
            }
            finally
            {
                automaticRejoinPending.remove(userId);
            }
        }, 2500L);
    }
    private static void scheduleParticipantDeadlineCheck(
            Encounter encounter,
            int userId)
    {
        if(encounter == null || encounter.participants == null) return;

        long deadline = 0L;

        for(EncounterParticipant participant : encounter.participants)
        {
            if(participant.userId != userId) continue;

            deadline = Math.max(
                    participant.reconnectDeadlineEpoch,
                    participant.returnDeadlineEpoch
            );
            break;
        }

        if(deadline <= 0L) return;

        long now = System.currentTimeMillis() / 1000L;
        long delayMs = Math.max(1000L, ((deadline - now) + 1L) * 1000L);
        final int encounterId = encounter.id;

        Emulator.getThreading().run(() ->
        {
            try
            {
                Encounter refreshed = ServicioRpgEngine.getEncounter(encounterId);

                if(refreshed != null)
                    RpgEngineRealtime.pushRoomEncounters(
                            refreshed.roomId,
                            "participant-deadline-check"
                    );
            }
            catch(Exception error)
            {
                logEncounterEvent("deadline-check", userId, error);
            }
        }, delayMs);
    }

    private static void logEncounterEvent(
            String action,
            int userId,
            Exception error)
    {
        System.out.println(
                "[RPGEngine] Encounter event " + action +
                " failed for user " + userId + ": " +
                error.getClass().getName() + ": " + error.getMessage()
        );
    }

    @Override
    public void onDisable()
    {
    }

    @Override
    public boolean hasPermission(Habbo habbo, String permission)
    {
        return false;
    }
}
