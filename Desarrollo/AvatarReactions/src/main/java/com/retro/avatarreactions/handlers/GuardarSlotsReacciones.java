package com.retro.avatarreactions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.avatarreactions.ServicioReacciones;

import java.util.ArrayList;
import java.util.List;

public class GuardarSlotsReacciones extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;

        int userId = this.client.getHabbo().getHabboInfo().getId();
        int count = this.packet.readInt().intValue();

        if(count != ServicioReacciones.SLOT_COUNT) return;

        List<Integer> reactionIds = new ArrayList<>();

        for(int i = 0; i < count; i++)
        {
            reactionIds.add(this.packet.readInt().intValue());
        }

        try
        {
            ServicioReacciones.guardarSlots(userId, reactionIds);

            this.client.sendResponse(
                    ServicioReacciones.crearMensajePerfil(userId)
            );
        }
        catch(SecurityException error)
        {
            System.out.println(
                    "[AvatarReactions] SAVE_SLOTS rechazado user=" +
                    userId + ": " + error.getMessage()
            );
        }
        catch(Exception error)
        {
            System.out.println(
                    "[AvatarReactions] ERROR guardando slots: " +
                    error.getClass().getName() + ": " + error.getMessage()
            );
            error.printStackTrace();
        }
    }
}
