package com.retro.avatarreactions.handlers;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.avatarreactions.AvatarReactions;
import com.retro.avatarreactions.ReactionPackets;
import com.retro.avatarreactions.ServicioReacciones;

public class EnviarReaccionAvatar extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;

        Habbo habbo = this.client.getHabbo();
        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null || habbo.getRoomUnit() == null) return;

        int reactionId = this.packet.readInt().intValue();

        if(reactionId <= 0) return;

        int userId = habbo.getHabboInfo().getId();

        // Cortamos spam antes de consultar DB.
        if(!AvatarReactions.consumirCooldown(userId)) return;

        try
        {
            // El servidor decide si existe, esta habilitada, la posee
            // y esta equipada entre sus 12 accesos rapidos.
            ServicioReacciones.Reaccion reaction =
                    ServicioReacciones.obtenerReaccionUtilizable(
                            userId,
                            reactionId
                    );

            if(reaction == null) return;

            ServerMessage respuesta =
                    new ServerMessage(ReactionPackets.BROADCAST_REACTION);

            respuesta.appendInt(habbo.getRoomUnit().getId());
            respuesta.appendInt(reaction.id);
            respuesta.appendString(reaction.glyph);

            room.sendComposer(respuesta);
        }
        catch(Exception error)
        {
            System.out.println(
                    "[AvatarReactions] ERROR enviando reaccion: " +
                    error.getClass().getName() + ": " + error.getMessage()
            );
            error.printStackTrace();
        }
    }
}
