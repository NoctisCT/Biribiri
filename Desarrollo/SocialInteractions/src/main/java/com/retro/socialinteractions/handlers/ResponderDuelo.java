package com.retro.socialinteractions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.socialinteractions.DuelManager;

public class ResponderDuelo extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null ||
           this.client.getHabbo() == null)
        {
            return;
        }

        int duelId =
                this.packet.readInt().intValue();

        int accepted =
                this.packet.readInt().intValue();

        DuelManager.respond(
                this.client.getHabbo(),
                duelId,
                accepted == 1
        );
    }
}
