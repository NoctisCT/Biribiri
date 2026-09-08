package com.retro.socialinteractions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.socialinteractions.PartyManager;

public class AccionParty extends MessageHandler
{
    @Override public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;
        int action = this.packet.readInt().intValue();
        int targetUserId = this.packet.readInt().intValue();
        PartyManager.action(this.client.getHabbo(), action, targetUserId);
    }
}
