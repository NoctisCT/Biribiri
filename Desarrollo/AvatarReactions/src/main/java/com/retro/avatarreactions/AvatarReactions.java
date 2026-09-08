package com.retro.avatarreactions;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import com.eu.habbo.plugin.events.users.UserDisconnectEvent;
import com.retro.avatarreactions.handlers.EnviarReaccionAvatar;
import com.retro.avatarreactions.handlers.GuardarModoReacciones;
import com.retro.avatarreactions.handlers.GuardarSlotsReacciones;
import com.retro.avatarreactions.handlers.ObtenerPerfilReacciones;

import java.util.concurrent.ConcurrentHashMap;

public class AvatarReactions extends HabboPlugin implements EventListener
{
    private static final long COOLDOWN_MS = 1800L;
    private static final ConcurrentHashMap<Integer, Long> ULTIMA_REACCION =
            new ConcurrentHashMap<>();

    @Override
    public void onEnable()
    {
        Emulator.getPluginManager().registerEvents(this, this);
    }

    @EventHandler
    public void onEmulatorLoaded(EmulatorLoadedEvent evento) throws Exception
    {
        BaseDatosReacciones.inicializar();

        Emulator.getGameServer().getPacketManager()
                .registerHandler(
                        ReactionPackets.SEND_REACTION,
                        EnviarReaccionAvatar.class
                );

        Emulator.getGameServer().getPacketManager()
                .registerHandler(
                        ReactionPackets.GET_PROFILE,
                        ObtenerPerfilReacciones.class
                );

        Emulator.getGameServer().getPacketManager()
                .registerHandler(
                        ReactionPackets.SAVE_SLOTS,
                        GuardarSlotsReacciones.class
                );

        Emulator.getGameServer().getPacketManager()
                .registerHandler(
                        ReactionPackets.SAVE_DISPLAY_MODE,
                        GuardarModoReacciones.class
                );

        System.out.println(
                "[AvatarReactions] Reacciones definitivas activas: " +
                "5047/5048/5049/5056/5057/5058"
        );
    }

    public static boolean consumirCooldown(int userId)
    {
        long now = System.currentTimeMillis();
        Long previous = ULTIMA_REACCION.get(userId);

        if(previous != null && (now - previous) < COOLDOWN_MS)
        {
            return false;
        }

        ULTIMA_REACCION.put(userId, now);
        return true;
    }

    @EventHandler
    public void onUserDisconnect(UserDisconnectEvent evento)
    {
        if(evento.habbo == null) return;

        ULTIMA_REACCION.remove(
                evento.habbo.getHabboInfo().getId()
        );
    }

    @Override
    public void onDisable()
    {
        ULTIMA_REACCION.clear();
    }

    @Override
    public boolean hasPermission(Habbo habbo, String permiso)
    {
        return false;
    }
}
