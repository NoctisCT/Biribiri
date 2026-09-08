package com.retro.avatarreactions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.avatarreactions.ServicioReacciones;

public class GuardarModoReacciones extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;

        int userId = this.client.getHabbo().getHabboInfo().getId();
        int mode = this.packet.readInt().intValue();

        if(mode < ServicioReacciones.DISPLAY_BOXED ||
           mode > ServicioReacciones.DISPLAY_HIDDEN)
        {
            return;
        }

        try
        {
            ServicioReacciones.guardarModo(userId, mode);

            this.client.sendResponse(
                    ServicioReacciones.crearMensajePerfil(userId)
            );
        }
        catch(Exception error)
        {
            System.out.println(
                    "[AvatarReactions] ERROR guardando modo: " +
                    error.getClass().getName() + ": " + error.getMessage()
            );
            error.printStackTrace();
        }
    }
}
