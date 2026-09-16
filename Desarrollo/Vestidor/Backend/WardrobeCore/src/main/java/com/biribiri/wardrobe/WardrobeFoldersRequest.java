package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeFoldersRequest
extends MessageHandler
{
    @Override
    public void handle() throws Exception
    {
        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(
            plugin == null ||
            this.client == null ||
            this.client.getHabbo() == null
        )
        {
            return;
        }

        plugin.getManager()
            .sendFolders(
                this.client
            );
    }

    @Override
    public int getRatelimit()
    {
        return 250;
    }
}
