package com.retro.airhockey;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.items.ItemInteraction;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadItemsManagerEvent;
import com.eu.habbo.plugin.events.furniture.FurnitureToggleEvent;
import com.retro.airhockey.mensajes.AirHockeyLeave;
import com.retro.airhockey.mensajes.AirHockeyMove;
import com.retro.airhockey.mensajes.AirHockeyReady;

public final class AirHockeyPlugin extends HabboPlugin implements EventListener
{
    /*
     * Bloque reservado Air Hockey V0/V1.
     *
     * Cliente -> servidor:
     * 6000 MOVE
     * 6001 READY
     * 6002 LEAVE
     *
     * Servidor -> cliente:
     * 6003 OPEN
     * 6004 STATE
     * 6005 ROUND
     * 6006 CLOSE
     * 6007 ERROR
     */
    public static final int PACKET_MOVE = 6000;
    public static final int PACKET_READY = 6001;
    public static final int PACKET_LEAVE = 6002;
    public static final int PACKET_OPEN = 6003;
    public static final int PACKET_STATE = 6004;
    public static final int PACKET_ROUND = 6005;
    public static final int PACKET_CLOSE = 6006;
    public static final int PACKET_ERROR = 6007;

    public static final String INTERACTION = "air_hockey";

    private static AirHockeyPlugin instance;

    private final AirHockeyManager manager = new AirHockeyManager();

    public static AirHockeyPlugin getInstance()
    {
        return instance;
    }

    public AirHockeyManager getManager()
    {
        return this.manager;
    }

    @Override
    public void onEnable()
    {
        instance = this;
        Emulator.getPluginManager().registerEvents(this, this);
        System.out.println("[AirHockey] Plugin habilitado.");
    }

    @EventHandler
    public void onLoadItemsManager(EmulatorLoadItemsManagerEvent event)
    {
        Emulator.getGameEnvironment()
                .getItemManager()
                .addItemInteraction(
                        new ItemInteraction(
                                INTERACTION,
                                InteractionAirHockey.class
                        )
                );

        System.out.println("[AirHockey] Interaction registrada: " + INTERACTION);
    }

    @EventHandler
    public void onEmulatorLoaded(EmulatorLoadedEvent event) throws Exception
    {
        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(PACKET_MOVE, AirHockeyMove.class);

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(PACKET_READY, AirHockeyReady.class);

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(PACKET_LEAVE, AirHockeyLeave.class);

        this.manager.start();

        System.out.println("[AirHockey] Packets 6000-6007 reservados; handlers activos.");
    }

    @EventHandler
    public void onAirHockeyFurnitureToggle(FurnitureToggleEvent event)
    {
        if(event == null ||
                event.furniture == null ||
                event.furniture.getBaseItem() == null ||
                event.furniture.getBaseItem().getId() != 76415549)
        {
            return;
        }

        System.out.println(
                "[AirHockey][TRACE] TOGGLE itemId=" + event.furniture.getId() +
                " runtimeClass=" + event.furniture.getClass().getName() +
                " base=" + event.furniture.getBaseItem().getName() +
                " state=" + event.state +
                " cancelledAtListener=" + event.isCancelled()
        );
    }

    @Override
    public void onDisable()
    {
        this.manager.stop();
        instance = null;
        System.out.println("[AirHockey] Plugin deshabilitado.");
    }

    @Override
    public boolean hasPermission(Habbo habbo, String permission)
    {
        return false;
    }
}
