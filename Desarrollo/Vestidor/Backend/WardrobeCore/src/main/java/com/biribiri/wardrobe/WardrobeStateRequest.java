package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeStateRequest extends MessageHandler
{
    @Override
    public void handle() throws Exception
    {
        BiribiriWardrobePlugin.getInstance().getManager().sendState(this.client);
    }

    @Override
    public int getRatelimit()
    {
        return 500;
    }
}
