package com.biribiri.wardrobe;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.MessageComposer;

import java.util.Map;

public final class WardrobeClothingFavoritesComposer
    extends MessageComposer
{
    private final Map<String, java.util.List<Integer>> favorites;

    public WardrobeClothingFavoritesComposer(
        Map<String, java.util.List<Integer>> favorites
    )
    {
        this.favorites = favorites;
    }

    @Override
    protected ServerMessage composeInternal()
    {
        this.response.init(
            BiribiriWardrobePlugin.PACKET_CLOTHING_FAVORITES_RESPONSE
        );

        int count = 0;

        if(this.favorites != null)
        {
            for(
                java.util.List<Integer> ids :
                this.favorites.values()
            )
            {
                if(ids != null)
                {
                    count +=
                        ids.size();
                }
            }
        }

        this.response.appendInt(
            count
        );

        if(this.favorites != null)
        {
            for(
                Map.Entry<String, java.util.List<Integer>> entry :
                this.favorites.entrySet()
            )
            {
                if(entry.getValue() == null)
                {
                    continue;
                }

                for(
                    Integer figureSetId :
                    entry.getValue()
                )
                {
                    if(
                        figureSetId == null ||
                        figureSetId.intValue() == 0 ||
                        figureSetId.intValue() == -1
                    )
                    {
                        continue;
                    }

                    this.response.appendString(
                        entry.getKey()
                    );

                    this.response.appendInt(
                        figureSetId.intValue()
                    );
                }
            }
        }

        return this.response;
    }
}
