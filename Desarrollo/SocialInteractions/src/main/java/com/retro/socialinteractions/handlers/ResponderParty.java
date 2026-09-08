package com.retro.socialinteractions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.socialinteractions.PartyManager;

public class ResponderParty extends MessageHandler
{
    @Override public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;
        int inviteId = this.packet.readInt().intValue();
        boolean accepted = this.packet.readInt().intValue() == 1;
        PartyManager.respondInvite(this.client.getHabbo(), inviteId, accepted);
    }
}
