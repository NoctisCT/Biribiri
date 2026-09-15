package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeClothingFavoritesRequest
    extends MessageHandler
{
    @Override
    public void handle() throws Exception
    {
        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(plugin == null) return;

        plugin
            .getManager()
            .sendClothingFavorites(
                this.client
            );
    }

    @Override
    public int getRatelimit()
    {
        return 300;
    }
}
