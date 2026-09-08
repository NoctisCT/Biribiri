package com.retro.socialinteractions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.socialinteractions.PartyManager;

public class ChatParty extends MessageHandler
{
    @Override public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;
        int partyId = this.packet.readInt().intValue();
        String message = this.packet.readString();
        PartyManager.chat(this.client.getHabbo(), partyId, message);
    }
}
