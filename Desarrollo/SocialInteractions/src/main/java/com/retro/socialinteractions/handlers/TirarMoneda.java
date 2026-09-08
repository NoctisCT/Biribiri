package com.retro.socialinteractions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.socialinteractions.CoinManager;

public class TirarMoneda extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null ||
           this.client.getHabbo() == null)
        {
            return;
        }

        int targetUserId =
                this.packet.readInt().intValue();

        CoinManager.challenge(
                this.client.getHabbo(),
                targetUserId
        );
    }
}
