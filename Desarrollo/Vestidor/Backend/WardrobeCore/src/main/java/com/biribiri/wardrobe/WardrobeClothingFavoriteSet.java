package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeClothingFavoriteSet
    extends MessageHandler
{
    @Override
    public void handle() throws Exception
    {
        if(
            this.client == null ||
            this.client.getHabbo() == null ||
            this.packet == null
        )
        {
            return;
        }

        String figureType =
            this.packet.readString();

        int figureSetId =
            this.packet
                .readInt()
                .intValue();

        boolean favorite =
            this.packet.readBoolean();

        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(plugin == null) return;

        plugin
            .getManager()
            .setClothingFavorite(
                this.client.getHabbo(),
                figureType,
                figureSetId,
                favorite
            );

        // El servidor responde siempre con el estado real.
        plugin
            .getManager()
            .sendClothingFavorites(
                this.client
            );
    }

    @Override
    public int getRatelimit()
    {
        return 100;
    }
}
