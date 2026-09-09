package com.retro.builderpro;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import com.eu.habbo.plugin.events.furniture.FurnitureBuildheightEvent;
import com.eu.habbo.plugin.events.furniture.FurnitureMovedEvent;
import com.retro.builderpro.handlers.MoveGroupRequest;
import com.retro.builderpro.handlers.TransformGroupRequest;

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

        System.out.println(
                "[BuilderPro] Backend MVP 0 cargado."
        );
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

    @Override
    public void onDisable()
    {
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
