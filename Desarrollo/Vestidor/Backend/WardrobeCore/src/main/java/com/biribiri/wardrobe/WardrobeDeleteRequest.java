package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeDeleteRequest
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

        int slotId =
            this.packet.readInt();

        int status =
            plugin.getManager()
                .deleteOutfit(
                    this.client.getHabbo(),
                    slotId
                );

        this.client.sendResponse(
            new WardrobeDeleteResultComposer(
                status,
                slotId
            )
        );

        if(
            status ==
            WardrobeManager.DELETE_SUCCESS
        )
        {
            plugin.getManager()
                .sendFolders(
                    this.client
                );
        }
    }

    @Override
    public int getRatelimit()
    {
        return 250;
    }
}
