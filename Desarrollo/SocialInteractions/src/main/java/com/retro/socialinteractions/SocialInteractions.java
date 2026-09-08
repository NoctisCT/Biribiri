package com.retro.socialinteractions;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import com.eu.habbo.plugin.events.roomunit.RoomUnitSetGoalEvent;
import com.eu.habbo.plugin.events.users.UserDisconnectEvent;
import com.retro.socialinteractions.handlers.AlternarSeguir;
import com.retro.socialinteractions.handlers.ElegirDuelo;
import com.retro.socialinteractions.handlers.ResponderDuelo;
import com.retro.socialinteractions.handlers.SolicitarDuelo;
import com.retro.socialinteractions.handlers.ResponderMoneda;
import com.retro.socialinteractions.handlers.TirarMoneda;
import com.retro.socialinteractions.handlers.AccionParty;
import com.retro.socialinteractions.handlers.ChatParty;
import com.retro.socialinteractions.handlers.InvitarParty;
import com.retro.socialinteractions.handlers.ResponderParty;
import com.retro.socialinteractions.handlers.VisitarParty;

public class SocialInteractions extends HabboPlugin implements EventListener
{
    @Override
    public void onEnable()
    {
        Emulator.getPluginManager()
                .registerEvents(this, this);
    }

    @EventHandler
    public void onEmulatorLoaded(
            EmulatorLoadedEvent evento)
            throws Exception
    {
        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.DUEL_CHALLENGE,
                        SolicitarDuelo.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.DUEL_RESPONSE,
                        ResponderDuelo.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.DUEL_CHOICE,
                        ElegirDuelo.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.FOLLOW_TOGGLE,
                        AlternarSeguir.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.COIN_TOSS,
                        TirarMoneda.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.COIN_RESPONSE,
                        ResponderMoneda.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.PARTY_INVITE,
                        InvitarParty.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.PARTY_INVITE_RESPONSE,
                        ResponderParty.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.PARTY_ACTION,
                        AccionParty.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.PARTY_CHAT,
                        ChatParty.class
                );

        Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                        InteractionPackets.PARTY_VISIT,
                        VisitarParty.class
                );

        DuelManager.start();
        FollowManager.start();
        CoinManager.start();
        PartyManager.start();

        System.out.println(
                "[SocialInteractions] "
                + "Interactuar activo: "
                + "Duelo + Seguir + Tirar Moneda "
                + "(5059-5069)"
        );
    }

    @EventHandler
    public void onRoomUnitSetGoal(
            RoomUnitSetGoalEvent evento)
    {
        FollowManager.onGoalSet(
                evento.room,
                evento.roomUnit
        );
    }

    @EventHandler
    public void onUserDisconnect(
            UserDisconnectEvent evento)
    {
        if(evento.habbo == null)
        {
            return;
        }

        int userId =
                evento.habbo
                        .getHabboInfo()
                        .getId();

        DuelManager.onDisconnect(
                userId
        );

        FollowManager.onDisconnect(
                userId
        );

        CoinManager.onDisconnect(
                userId
        );

        PartyManager.onDisconnect(
                userId
        );
    }

    @Override
    public void onDisable()
    {
        DuelManager.stop();
        FollowManager.stop();
        CoinManager.stop();
        PartyManager.stop();
    }

    @Override
    public boolean hasPermission(
            Habbo habbo,
            String permiso)
    {
        return false;
    }
}
