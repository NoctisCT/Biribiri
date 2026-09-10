package com.retro.builderpro;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.outgoing.rooms.users.RoomUserStatusComposer;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import com.eu.habbo.plugin.events.furniture.FurnitureBuildheightEvent;
import com.eu.habbo.plugin.events.furniture.FurnitureMovedEvent;
import com.eu.habbo.plugin.events.furniture.FurniturePlacedEvent;
import com.eu.habbo.plugin.events.furniture.FurniturePickedUpEvent;
import com.eu.habbo.plugin.events.rooms.RoomLoadedEvent;
import com.eu.habbo.plugin.events.users.UserTakeStepEvent;
import com.eu.habbo.plugin.events.users.UserCommandEvent;
import com.retro.builderpro.handlers.CopyGroupRequest;
import com.retro.builderpro.handlers.PasteGroupRequest;
import com.retro.builderpro.handlers.MoveGroupRequest;
import com.retro.builderpro.handlers.OffsetGroupRequest;
import com.retro.builderpro.handlers.LayoutGroupRequest;
import com.retro.builderpro.handlers.TransformGroupRequest;
import com.retro.builderpro.handlers.HistoryRequest;
import com.retro.builderpro.handlers.GroupStateRequest;
import com.retro.builderpro.handlers.TraversalStateRequest;

public class BuilderProPlugin
        extends HabboPlugin
        implements EventListener
{
    @Override
    public void onEnable()
    {
        Emulator.getPluginManager()
                .registerEvents(this, this);
    }

    @EventHandler
    public void onEmulatorLoaded(
            EmulatorLoadedEvent event)
            throws Exception
    {
        BuilderProGroupRepository.initialize();
        BuilderProTraversalService.initialize();

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        BuilderProPackets.MOVE_GROUP_REQUEST,
                        MoveGroupRequest.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        BuilderProPackets.TRANSFORM_GROUP_REQUEST,
                        TransformGroupRequest.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        BuilderProPackets.COPY_GROUP_REQUEST,
                        CopyGroupRequest.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        BuilderProPackets.PASTE_GROUP_REQUEST,
                        PasteGroupRequest.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        BuilderProPackets.HISTORY_REQUEST,
                        HistoryRequest.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        BuilderProPackets.OFFSET_GROUP_REQUEST,
                        OffsetGroupRequest.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        BuilderProPackets.LAYOUT_GROUP_REQUEST,
                        LayoutGroupRequest.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        BuilderProPackets.GROUP_STATE_REQUEST,
                        GroupStateRequest.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        BuilderProPackets.TRAVERSAL_STATE_REQUEST,
                        TraversalStateRequest.class
                );

        System.out.println(
                "[BuilderPro] Backend MVP 0 cargado."
        );
    }

    @EventHandler
    public void onFurniturePickedUp(
            FurniturePickedUpEvent event)
    {
        if(event == null
                || event.furniture == null)
        {
            return;
        }

        final int itemId =
                event.furniture.getId();

        final int roomId =
                event.furniture.getRoomId();

        Emulator.getThreading().run(
                () ->
                {
                    if(event.isCancelled())
                    {
                        return;
                    }

                    try
                    {
                        BuilderProGroupRepository.removeItem(
                                itemId
                        );

                        BuilderProTraversalService.removeItem(
                                roomId,
                                itemId
                        );

                        Room room =
                                Emulator.getGameEnvironment()
                                        .getRoomManager()
                                        .getRoom(
                                                roomId
                                        );

                        BuilderProTraversalService
                                .refreshRoomCollision(
                                        room
                                );
                    }
                    catch(Exception exception)
                    {
                        System.err.println(
                                "[BuilderPro] No se pudo limpiar el furni "
                                        + itemId
                                        + " de su grupo."
                        );

                        exception.printStackTrace();
                    }
                },
                50L
        );
    }

    @EventHandler
    public void onRoomLoaded(
            RoomLoadedEvent event)
    {
        if(event == null
                || event.room == null)
        {
            return;
        }

        final Room room =
                event.room;

        Emulator.getThreading().run(
                () ->
                    BuilderProTraversalService
                            .refreshRoomCollision(
                                    room
                            ),
                50L
        );
    }



    @EventHandler
    public void onUserTakeStep(
            UserTakeStepEvent event)
    {
        if(event == null
                || event.habbo == null)
        {
            return;
        }

        BuilderProTraversalService.prepareStep(
                event.habbo,
                event.habbo
                        .getHabboInfo()
                        .getCurrentRoom(),
                event.fromLocation,
                event.toLocation
        );
    }

    @EventHandler
    public void onFurniturePlaced(
            FurniturePlacedEvent event)
    {
        if(event == null
                || event.habbo == null
                || event.furniture == null)
        {
            return;
        }

        int actorId =
                event.habbo
                        .getHabboInfo()
                        .getId();

        int itemId =
                event.furniture
                        .getId();

        if(BuilderProContext.appliesTo(
                actorId,
                itemId))
        {
            event.setPluginHelper(true);
        }

        final Room room =
                event.habbo
                        .getHabboInfo()
                        .getCurrentRoom();

        if(room != null)
        {
            Emulator.getThreading().run(
                    () ->
                        BuilderProTraversalService
                                .refreshRoomCollision(
                                        room
                                ),
                    50L
            );
        }
    }

    @EventHandler
    public void onFurnitureMoved(
            FurnitureMovedEvent event)
    {
        if(event == null
                || event.habbo == null
                || event.furniture == null)
        {
            return;
        }

        int actorId =
                event.habbo
                        .getHabboInfo()
                        .getId();

        int itemId =
                event.furniture
                        .getId();

        if(BuilderProContext.appliesTo(
                actorId,
                itemId))
        {
            event.setPluginHelper(true);
        }

        final Room room =
                event.habbo
                        .getHabboInfo()
                        .getCurrentRoom();

        if(room != null)
        {
            Emulator.getThreading().run(
                    () ->
                        BuilderProTraversalService
                                .refreshRoomCollision(
                                        room
                                ),
                    50L
            );
        }
    }

    @EventHandler
    public void onFurnitureBuildHeight(
            FurnitureBuildheightEvent event)
    {
        if(event == null
                || event.habbo == null
                || event.furniture == null)
        {
            return;
        }

        int actorId =
                event.habbo
                        .getHabboInfo()
                        .getId();

        Double forcedHeight =
                BuilderProContext.getForcedHeight(
                        actorId,
                        event.furniture.getId()
                );

        if(forcedHeight != null)
        {
            event.setNewHeight(
                    forcedHeight.doubleValue()
            );
        }
    }

    @EventHandler
    public void onUserCommand(
            UserCommandEvent event)
    {
        if(event == null
                || event.habbo == null
                || event.args == null
                || event.args.length == 0
                || !event.succes
                || !event.args[0]
                        .equalsIgnoreCase(
                                "lay"
                        )
                || event.habbo.getRoomUnit() == null)
        {
            return;
        }

        Room room =
                event.habbo
                        .getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return;
        }

        Double surfaceZ =
                BuilderProTraversalService
                        .getTraversalSurfaceZ(
                                room,
                                event.habbo
                                        .getRoomUnit()
                                        .getCurrentLocation()
                        );

        if(surfaceZ == null)
        {
            return;
        }

        event.habbo
                .getRoomUnit()
                .setZ(
                        surfaceZ.doubleValue()
                );

        event.habbo
                .getRoomUnit()
                .setPreviousLocationZ(
                        surfaceZ.doubleValue()
                );

        room.sendComposer(
                new RoomUserStatusComposer(
                        event.habbo
                                .getRoomUnit()
                ).compose()
        );
    }

    @Override
    public void onDisable()
    {
        CopyGroupService.clearAll();
        BuilderProHistoryService.clearAll();
        BuilderProTraversalService.clearAll();
        BuilderProContext.clear();
    }

    @Override
    public boolean hasPermission(
            Habbo habbo,
            String permission)
    {
        return false;
    }
}
