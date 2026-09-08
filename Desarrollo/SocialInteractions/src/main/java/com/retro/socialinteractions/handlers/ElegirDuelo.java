package com.retro.socialinteractions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.socialinteractions.DuelManager;

public class ElegirDuelo extends MessageHandler
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

        int choice =
                this.packet.readInt().intValue();

        DuelManager.choose(
                this.client.getHabbo(),
                duelId,
                choice
        );
    }
}
