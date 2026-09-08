package com.retro.socialinteractions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.socialinteractions.CoinManager;

public class ResponderMoneda extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null ||
           this.client.getHabbo() == null)
        {
            return;
        }

        int challengeId =
                this.packet.readInt().intValue();

        boolean accepted =
                this.packet.readInt().intValue() == 1;

        CoinManager.respond(
                this.client.getHabbo(),
                challengeId,
                accepted
        );
    }
}
