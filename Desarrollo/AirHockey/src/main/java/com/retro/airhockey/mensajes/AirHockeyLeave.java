package com.retro.airhockey.mensajes;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.airhockey.AirHockeyPlugin;

public final class AirHockeyLeave extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null ||
                this.client.getHabbo() == null ||
                this.packet == null)
        {
            return;
        }

        int itemId = this.packet.readInt().intValue();

        AirHockeyPlugin plugin = AirHockeyPlugin.getInstance();

        if(plugin == null) return;

        plugin.getManager().leave(this.client, itemId);
    }
}
