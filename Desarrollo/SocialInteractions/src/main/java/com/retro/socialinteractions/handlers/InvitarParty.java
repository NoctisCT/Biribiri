package com.retro.socialinteractions.handlers;

import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.socialinteractions.PartyManager;

public class InvitarParty extends MessageHandler
{
    @Override public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;
        int targetUserId = this.packet.readInt().intValue();
        PartyManager.invite(this.client.getHabbo(), targetUserId);
    }
}
