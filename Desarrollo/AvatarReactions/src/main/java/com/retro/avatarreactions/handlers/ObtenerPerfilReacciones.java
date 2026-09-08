package com.retro.avatarreactions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.avatarreactions.ServicioReacciones;

public class ObtenerPerfilReacciones extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;

        int userId = this.client.getHabbo().getHabboInfo().getId();

        try
        {
            this.client.sendResponse(
                    ServicioReacciones.crearMensajePerfil(userId)
            );
        }
        catch(Exception error)
        {
            System.out.println(
                    "[AvatarReactions] ERROR obteniendo perfil: " +
                    error.getClass().getName() + ": " + error.getMessage()
            );
            error.printStackTrace();
        }
    }
}
